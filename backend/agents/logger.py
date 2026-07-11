"""
Agent Response Logger — stores all agent responses in SQLite for history access.
Day Logger — stores timestamped user notes throughout the day.
Uses the same chat_memory.db as the chat agent to keep everything in one file.
"""

import sqlite3
from datetime import datetime
from backend.config import WORKSPACE_DIR

DB_PATH = str(WORKSPACE_DIR / "chat_memory.db")

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agent_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            agent       TEXT    NOT NULL,
            input       TEXT    NOT NULL,
            response    TEXT    NOT NULL,
            created_at  TEXT    NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS day_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            note        TEXT    NOT NULL,
            created_at  TEXT    NOT NULL
        )
    """)
    conn.commit()
    return conn

def log_response(agent: str, input_text: str, response_text: str) -> None:
    """Persist a single agent response. agent = 'state_manager' | 'decision_engine' | 'reflection'."""
    conn = _get_conn()
    conn.execute(
        "INSERT INTO agent_logs (agent, input, response, created_at) VALUES (?, ?, ?, ?)",
        (agent, input_text, response_text, datetime.utcnow().isoformat())
    )
    conn.commit()

def get_logs(agent: str = None, limit: int = 30) -> list[dict]:
    """Return recent agent logs, optionally filtered by agent name."""
    conn = _get_conn()
    if agent:
        cursor = conn.execute(
            "SELECT id, agent, input, response, created_at FROM agent_logs "
            "WHERE agent = ? ORDER BY created_at DESC LIMIT ?",
            (agent, limit)
        )
    else:
        cursor = conn.execute(
            "SELECT id, agent, input, response, created_at FROM agent_logs "
            "ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
    return [
        {"id": r[0], "agent": r[1], "input": r[2], "response": r[3], "created_at": r[4]}
        for r in cursor.fetchall()
    ]

def delete_log(log_id: int) -> None:
    conn = _get_conn()
    conn.execute("DELETE FROM agent_logs WHERE id = ?", (log_id,))
    conn.commit()

# ------------------------------------------------------------------ #
# Day Logger — timestamped personal notes stored throughout the day
# ------------------------------------------------------------------ #

def add_day_log(note: str) -> dict:
    """Save a new day log note. Returns the saved entry."""
    conn = _get_conn()
    now = datetime.utcnow().isoformat()
    cursor = conn.execute(
        "INSERT INTO day_logs (note, created_at) VALUES (?, ?)",
        (note.strip(), now)
    )
    conn.commit()
    return {"id": cursor.lastrowid, "note": note.strip(), "created_at": now}

def get_day_logs(date_str: str = None) -> list[dict]:
    """
    Return all day log notes for a given date (YYYY-MM-DD).
    Defaults to today (UTC). Ordered chronologically (oldest first).
    """
    if date_str is None:
        date_str = datetime.utcnow().date().isoformat()
    conn = _get_conn()
    cursor = conn.execute(
        "SELECT id, note, created_at FROM day_logs "
        "WHERE date(created_at) = ? ORDER BY created_at ASC",
        (date_str,)
    )
    return [
        {"id": r[0], "note": r[1], "created_at": r[2]}
        for r in cursor.fetchall()
    ]

def delete_day_log(log_id: int) -> None:
    """Delete a single day log note by id."""
    conn = _get_conn()
    conn.execute("DELETE FROM day_logs WHERE id = ?", (log_id,))
    conn.commit()
