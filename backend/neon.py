"""
neon.py — Neon PostgreSQL sync layer for MindGraph.

Architecture: Local-first with explicit push.
- On startup:  pull_from_neon() restores markdown files + SQLite tables from Neon.
- During use:  everything runs locally (fast, zero Neon latency for agents).
- On demand:   push_to_neon() uploads current local state to Neon.
- Chat:        PostgresSaver writes directly to Neon on every message (handled in chat_agent.py).

If DATABASE_URL is not set, all functions are no-ops (local-only dev mode).
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from backend.config import DATABASE_URL, LIFE_DIR, WORKSPACE_DIR

# psycopg2 is only imported when DATABASE_URL is set (lazy import prevents
# import errors in local-only mode where the package may not be installed)
if DATABASE_URL:
    try:
        import psycopg2
        import psycopg2.extras
        _PSYCOPG2_AVAILABLE = True
    except ImportError:
        print("[Neon] WARNING: psycopg2 not installed. Run: pip install psycopg2-binary")
        _PSYCOPG2_AVAILABLE = False
else:
    _PSYCOPG2_AVAILABLE = False


DB_SQLITE_PATH = str(WORKSPACE_DIR / "chat_memory.db")

LIFE_FILES = [
    "0_context.md", "1_goals.md", "2_projects.md", "3_current_state.md",
    "4_decisions.md", "5_daily_log.md", "6_weekly_review.md",
    "7_ideas.md", "8_principles.md",
]

_last_synced_at: str | None = None   # ISO string, UTC


# ------------------------------------------------------------------ #
# Internal helpers
# ------------------------------------------------------------------ #

def _pg_conn():
    """Open a new psycopg2 connection to Neon."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def _ensure_schema(cur) -> None:
    """Create all required tables if they don't exist yet."""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS markdown_files (
            name        TEXT PRIMARY KEY,
            content     TEXT NOT NULL,
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS agent_logs (
            id          SERIAL PRIMARY KEY,
            agent       TEXT NOT NULL,
            input       TEXT NOT NULL,
            response    TEXT NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS day_logs (
            id          SERIAL PRIMARY KEY,
            note        TEXT NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sync_meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)


# ------------------------------------------------------------------ #
# Public API
# ------------------------------------------------------------------ #

def is_neon_available() -> bool:
    return bool(DATABASE_URL) and _PSYCOPG2_AVAILABLE


def get_last_synced_at() -> str | None:
    """Return the ISO timestamp of the last successful push, or None."""
    global _last_synced_at
    if _last_synced_at:
        return _last_synced_at
    if not DATABASE_URL:
        return None
    try:
        conn = _pg_conn()
        with conn.cursor() as cur:
            _ensure_schema(cur)
            conn.commit()
            cur.execute("SELECT value FROM sync_meta WHERE key = 'last_push_at'")
            row = cur.fetchone()
            _last_synced_at = row["value"] if row else None
        conn.close()
    except Exception as e:
        print(f"[Neon] Could not read sync_meta: {e}")
    return _last_synced_at


def pull_from_neon() -> dict:
    """
    On startup: download markdown files + SQLite tables from Neon.
    Overwrites local disk with the Neon-stored versions.
    Returns a summary dict.
    """
    if not DATABASE_URL:
        return {"skipped": True, "reason": "DATABASE_URL not set"}

    summary = {"markdown_files": [], "agent_logs": 0, "day_logs": 0}

    try:
        conn = _pg_conn()
        with conn.cursor() as cur:
            _ensure_schema(cur)
            conn.commit()

            # --- Markdown files ---
            cur.execute("SELECT name, content FROM markdown_files")
            rows = cur.fetchall()
            for row in rows:
                path: Path = LIFE_DIR / row["name"]
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(row["content"], encoding="utf-8")
                summary["markdown_files"].append(row["name"])

            # --- SQLite: agent_logs ---
            cur.execute("SELECT agent, input, response, created_at FROM agent_logs ORDER BY id ASC")
            agent_log_rows = cur.fetchall()

            # --- SQLite: day_logs ---
            cur.execute("SELECT note, created_at FROM day_logs ORDER BY id ASC")
            day_log_rows = cur.fetchall()

        conn.close()

        # Rewrite SQLite tables from Neon data
        sconn = sqlite3.connect(DB_SQLITE_PATH, check_same_thread=False)
        sconn.execute("""
            CREATE TABLE IF NOT EXISTS agent_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent TEXT NOT NULL,
                input TEXT NOT NULL,
                response TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        sconn.execute("""
            CREATE TABLE IF NOT EXISTS day_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        # Replace content (clear + re-insert)
        sconn.execute("DELETE FROM agent_logs")
        for r in agent_log_rows:
            sconn.execute(
                "INSERT INTO agent_logs (agent, input, response, created_at) VALUES (?, ?, ?, ?)",
                (r["agent"], r["input"], r["response"], str(r["created_at"]))
            )
        sconn.execute("DELETE FROM day_logs")
        for r in day_log_rows:
            sconn.execute(
                "INSERT INTO day_logs (note, created_at) VALUES (?, ?)",
                (r["note"], str(r["created_at"]))
            )
        sconn.commit()
        sconn.close()

        summary["agent_logs"] = len(agent_log_rows)
        summary["day_logs"] = len(day_log_rows)
        print(f"[Neon] Pull complete: {summary}")
    except Exception as e:
        print(f"[Neon] Pull failed: {e}")
        summary["error"] = str(e)

    return summary


def push_to_neon() -> dict:
    """
    On demand: upload all local markdown files + SQLite tables to Neon.
    Called by the frontend 'Push to Neon' button via POST /api/neon/push.
    Returns a summary dict.
    """
    global _last_synced_at

    if not DATABASE_URL:
        return {"skipped": True, "reason": "DATABASE_URL not set"}

    summary = {"markdown_files": [], "agent_logs": 0, "day_logs": 0}
    now = datetime.now(timezone.utc).isoformat()

    try:
        # Read local SQLite data
        sconn = sqlite3.connect(DB_SQLITE_PATH, check_same_thread=False)
        sconn.row_factory = sqlite3.Row
        agent_logs = sconn.execute(
            "SELECT agent, input, response, created_at FROM agent_logs"
        ).fetchall()
        day_logs = sconn.execute(
            "SELECT note, created_at FROM day_logs"
        ).fetchall()
        sconn.close()

        conn = _pg_conn()
        with conn.cursor() as cur:
            _ensure_schema(cur)

            # --- Markdown files (upsert) ---
            for fname in LIFE_FILES:
                path = LIFE_DIR / fname
                if path.is_file():
                    content = path.read_text(encoding="utf-8")
                    cur.execute("""
                        INSERT INTO markdown_files (name, content, updated_at)
                        VALUES (%s, %s, NOW())
                        ON CONFLICT (name) DO UPDATE
                        SET content = EXCLUDED.content, updated_at = NOW()
                    """, (fname, content))
                    summary["markdown_files"].append(fname)

            # --- agent_logs (full replace) ---
            cur.execute("DELETE FROM agent_logs")
            for r in agent_logs:
                cur.execute(
                    "INSERT INTO agent_logs (agent, input, response, created_at) VALUES (%s, %s, %s, %s)",
                    (r["agent"], r["input"], r["response"], r["created_at"])
                )
            summary["agent_logs"] = len(agent_logs)

            # --- day_logs (full replace) ---
            cur.execute("DELETE FROM day_logs")
            for r in day_logs:
                cur.execute(
                    "INSERT INTO day_logs (note, created_at) VALUES (%s, %s)",
                    (r["note"], r["created_at"])
                )
            summary["day_logs"] = len(day_logs)

            # --- Update sync timestamp ---
            cur.execute("""
                INSERT INTO sync_meta (key, value) VALUES ('last_push_at', %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
            """, (now,))

        conn.commit()
        conn.close()

        _last_synced_at = now
        summary["pushed_at"] = now
        print(f"[Neon] Push complete: {summary}")
    except Exception as e:
        print(f"[Neon] Push failed: {e}")
        summary["error"] = str(e)

    return summary


def get_pg_pool():
    """
    Return a psycopg (v3) connection pool for LangGraph PostgresSaver.
    Returns None if DATABASE_URL is not set.
    """
    if not DATABASE_URL:
        return None
    try:
        from psycopg_pool import ConnectionPool
        from psycopg.rows import dict_row
        pool = ConnectionPool(
            conninfo=DATABASE_URL,
            kwargs={"autocommit": True, "row_factory": dict_row},
            min_size=1,
            max_size=5,
            open=True,
        )
        return pool
    except Exception as e:
        print(f"[Neon] Could not create pg pool for LangGraph: {e}")
        return None
