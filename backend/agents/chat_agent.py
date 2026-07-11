"""
Chat Agent — Personal AI with persistent SQLite memory.

Architecture:
- LangGraph graph with SqliteSaver checkpointer (thread-based memory)
- Each conversation = a unique thread_id (UUID)
- First message of each thread: markdown files are injected as system context
- Subsequent messages: only the user message + trimmed history (last MAX_HISTORY pairs)
- Full history is always stored in SQLite; LLM only sees a relevant window
"""

import sqlite3
from typing import Annotated, Any, Dict
from langchain_core.messages import (
    HumanMessage, SystemMessage, AIMessage, trim_messages
)
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver
from typing_extensions import TypedDict
from backend.config import LIFE_DIR, GEMINI_API_KEY, WORKSPACE_DIR, GEMINI_MODEL, DATABASE_URL

# ------------------------------------------------------------------ #
# Config
# ------------------------------------------------------------------ #
DB_PATH = str(WORKSPACE_DIR / "chat_memory.db")
MAX_HISTORY_MESSAGES = 40   # Max messages sent to LLM (excludes system msg)

SYSTEM_PROMPT = """You are the user's personal AI — a direct, honest thinking partner embedded in MindGraph, their personal productivity system.

## Your role
You are the conversational layer of MindGraph. You know the user deeply. You have their full life context — goals, projects, current state, decisions, ideas, and principles — loaded into your memory at the start of each conversation. You do not need to be told who they are or what they're working on. You already know.

You are NOT a task manager. You are NOT a scheduler. You are a thinking partner. You help the user:
- Think through decisions and tradeoffs
- Reflect on what they're doing and why
- Reason about priorities when they're uncertain
- Process what happened, how they feel about it, where they're stuck
- Brainstorm, explore ideas, challenge assumptions
- Talk through anything — personal, professional, strategic

## The MindGraph system you're part of
The user has two other specialized agents they invoke separately:

**State Manager**: Updates the markdown files (the user's source of truth — goals, state, decisions, projects, etc.) when the user reports progress or new information. It has a tool that writes files directly. The user goes there to record what happened.

**Decision Engine**: Reads the markdown files and generates a priority plan for the day given the user's available time and energy. The user goes there for structured daily planning.

**Reflection Agent**: Runs weekly (typically Sundays) to analyze the daily log for patterns, bottlenecks, and to suggest one improvement and one new principle.

You are the fourth, always-on layer. You don't update files. You don't generate formal plans. You talk.

## How to behave
- Be direct. Don't hedge unnecessarily.
- Be honest. If the user is making a mistake or a bad tradeoff, say so clearly.
- Ground everything in their actual context. Reference their real goals and situation when relevant, not generic advice.
- Keep responses concise unless depth is needed. Match the user's register.
- If the user is thinking out loud, think with them — don't jump to conclusions.
- If the user needs to update their State Manager after a decision or update, tell them.

## What you know (from memory)
Your life context — the markdown files — was loaded at the start of this conversation. You don't need it re-sent. You remember it."""

# ------------------------------------------------------------------ #
# State
# ------------------------------------------------------------------ #
class ChatState(TypedDict):
    messages: Annotated[list, add_messages]

# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #
def load_all_life_files() -> str:
    """Reads all markdown files and returns them formatted as context."""
    files_to_read = [
        "0_context.md", "1_goals.md", "2_projects.md", "3_current_state.md",
        "4_decisions.md", "5_daily_log.md", "6_weekly_review.md",
        "7_ideas.md", "8_principles.md"
    ]
    sections = []
    for filename in files_to_read:
        filepath = LIFE_DIR / filename
        if filepath.is_file():
            try:
                content = filepath.read_text(encoding="utf-8")
                sections.append(f"--- {filename} ---\n{content}")
            except Exception:
                pass
    return "\n\n".join(sections)

def is_first_turn(messages: list) -> bool:
    """Returns True if this is the first user message in the thread."""
    # Before the agent responds, the state has only the HumanMessage we just added.
    # If there are no AIMessages yet, it's the first turn.
    return not any(isinstance(m, AIMessage) for m in messages)

# ------------------------------------------------------------------ #
# Agent Node
# ------------------------------------------------------------------ #
def agent_node(state: ChatState) -> Dict[str, Any]:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=GEMINI_API_KEY,
        temperature=0.7,      # Slightly warmer for natural conversation
    )

    # System message always included
    system_msg = SystemMessage(content=SYSTEM_PROMPT)

    # On the first turn, prepend life context as a human→AI exchange
    # so the LLM treats it as established knowledge without making it
    # part of every subsequent token count.
    extra_context = []
    if is_first_turn(state["messages"]):
        life_context = load_all_life_files()
        extra_context = [
            HumanMessage(content=f"[CONTEXT LOAD] Here is my current life context:\n\n{life_context}"),
            AIMessage(content="Got it. I've read through your context — goals, current state, decisions, and principles. I'm ready. What's on your mind?")
        ]

    # Trim history to keep LLM context manageable.
    # trim_messages keeps the most recent N messages and always preserves system messages.
    history = trim_messages(
        state["messages"],
        max_tokens=MAX_HISTORY_MESSAGES,
        token_counter=len,          # Count by message count, not tokens
        strategy="last",
        allow_partial=False,
    )

    full_context = [system_msg] + extra_context + history
    response = llm.invoke(full_context)
    return {"messages": [response]}

# ------------------------------------------------------------------ #
# Graph + Checkpointer (PostgresSaver if Neon available, else SQLite)
# ------------------------------------------------------------------ #
def build_chat_graph(checkpointer):
    workflow = StateGraph(ChatState)
    workflow.add_node("agent", agent_node)
    workflow.set_entry_point("agent")
    workflow.add_edge("agent", END)
    return workflow.compile(checkpointer=checkpointer)


# Try PostgresSaver first (production); fall back to SqliteSaver (local dev)
_use_postgres = False
_sqlite_conn = None
_pg_pool = None

if DATABASE_URL:
    try:
        from langgraph.checkpoint.postgres import PostgresSaver
        from backend.neon import get_pg_pool
        _pg_pool = get_pg_pool()
        if _pg_pool:
            chat_checkpointer = PostgresSaver(_pg_pool)
            chat_checkpointer.setup()   # Creates LangGraph checkpoint tables if not exist
            chat_graph = build_chat_graph(chat_checkpointer)
            _use_postgres = True
            print("[Chat] Using PostgresSaver (Neon DB) for chat memory.")
        else:
            raise RuntimeError("pg_pool is None")
    except Exception as e:
        print(f"[Chat] PostgresSaver failed ({e}), falling back to SqliteSaver.")
        DATABASE_URL = None  # Force fallback path

if not _use_postgres:
    _sqlite_conn = sqlite3.connect(str(WORKSPACE_DIR / "chat_memory.db"), check_same_thread=False)
    chat_checkpointer = SqliteSaver(_sqlite_conn)
    chat_graph = build_chat_graph(chat_checkpointer)
    print("[Chat] Using SqliteSaver (local SQLite) for chat memory.")


# ------------------------------------------------------------------ #
# Thread list/delete helpers (called from main.py)
# ------------------------------------------------------------------ #
def list_thread_ids() -> list[str]:
    """Return all distinct chat thread IDs, newest first."""
    if _use_postgres and _pg_pool:
        try:
            with _pg_pool.connection() as conn:
                rows = conn.execute(
                    "SELECT DISTINCT thread_id FROM checkpoints ORDER BY thread_ts DESC"
                ).fetchall()
                return [r["thread_id"] for r in rows]
        except Exception:
            return []
    elif _sqlite_conn:
        try:
            cursor = _sqlite_conn.execute(
                "SELECT DISTINCT thread_id FROM checkpoints ORDER BY thread_ts DESC"
            )
            return [row[0] for row in cursor.fetchall()]
        except Exception:
            return []
    return []


def delete_thread_by_id(thread_id: str) -> None:
    """Delete all checkpoint rows for a given thread_id."""
    if _use_postgres and _pg_pool:
        with _pg_pool.connection() as conn:
            conn.execute("DELETE FROM checkpoints WHERE thread_id = %s", (thread_id,))
            conn.execute("DELETE FROM checkpoint_writes WHERE thread_id = %s", (thread_id,))
    elif _sqlite_conn:
        _sqlite_conn.execute("DELETE FROM checkpoints WHERE thread_id = ?", (thread_id,))
        _sqlite_conn.commit()
