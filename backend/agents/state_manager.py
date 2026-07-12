import json
from typing import Dict, List, Any, Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict
from backend.config import LIFE_DIR, GEMINI_API_KEY, GEMINI_MODEL

# -------------------------------------------------------------------
# Agent State
# -------------------------------------------------------------------
class StateManagerState(TypedDict):
    messages: Annotated[list, add_messages]

# -------------------------------------------------------------------
# Tool: Markdown Editor
# The LLM calls this to write one file at a time.
# -------------------------------------------------------------------
@tool
def markdown_editor(filename: str, content: str) -> str:
    """
    Write a complete, updated Markdown file to the knowledge base.

    Use this tool whenever a Markdown file needs to be updated.
    Always provide:
    - filename: the exact filename (e.g., '3_current_state.md')
    - content: the COMPLETE updated Markdown content. Never partial.

    Only call this tool for files that actually changed.
    """
    allowed_files = {
        "0_context.md", "1_goals.md", "2_projects.md",
        "3_current_state.md", "4_decisions.md", "5_daily_log.md",
        "6_weekly_review.md", "7_ideas.md", "8_principles.md"
    }
    if filename not in allowed_files:
        return f"ERROR: '{filename}' is not a recognized knowledge base file."

    filepath = LIFE_DIR / filename
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"OK: '{filename}' written successfully ({len(content)} chars)."
    except Exception as e:
        return f"ERROR writing '{filename}': {str(e)}"

TOOLS = [markdown_editor]

# -------------------------------------------------------------------
# System Prompt
# -------------------------------------------------------------------
SYSTEM_PROMPT = """You are the user's State Manager.

Your responsibility is to maintain the user's personal knowledge base stored as Markdown files.
These Markdown files are the source of truth about the user's life.

Your responsibilities include:
- Logging daily activity updates in the daily log (5_daily_log.md) under chronological date headings (e.g., ## YYYY-MM-DD).
- Updating current state.
- Updating project progress.
- Updating goals only when explicitly requested.
- Updating decisions when the user makes or changes one.
- Updating principles only when the user has clearly learned something worth remembering.
- Keeping files concise and removing stale information.
- Maintaining consistency between files.

You do NOT plan the user's day.
You do NOT create schedules.
You do NOT reprioritize long-term goals unless the user explicitly asks.

CONTEXT FORMAT: Your input may begin with a "DAY LOGGER NOTES" block containing timestamped notes the user
jotted throughout the day. Use these notes as supplementary context to understand what happened — they help
fill gaps in the user's end-of-day summary. When writing to 5_daily_log.md, synthesize both the logger notes
and the USER UPDATE into a coherent chronological entry. Do not copy logger notes verbatim — extract signal.

When files need updating, call the `markdown_editor` tool once per file.
Only update files that actually changed.
If no files need updating, say so clearly.

## How to behave
- Be highly concise and direct in your conversation. Do not yap, over-explain, or use unnecessary analogies/fluff.
- Just state what files you updated, what actions you took, or what clarifying questions you have clearly and directly.
- Preserve formatting when updating files.
- Return complete updated files, not patches.
- Avoid unnecessary wording changes.
- Never invent information.
- Ask clarifying questions if information is missing.

The Markdown files are the user's long-term memory. Treat them carefully."""

# -------------------------------------------------------------------
# Nodes
# -------------------------------------------------------------------
def build_llm():
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")
    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=GEMINI_API_KEY,
        temperature=0.2
    )
    return llm.bind_tools(TOOLS)

def load_knowledge_base() -> str:
    """Reads all relevant markdown files and returns a formatted string."""
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
                sections.append(f"--- FILE: {filename} ---\n{content}")
            except Exception as e:
                sections.append(f"--- FILE: {filename} ---\nError reading: {e}")
    return "\n\n".join(sections)

def agent_node(state: StateManagerState) -> Dict[str, Any]:
    """Calls the LLM (with tools bound). The LLM decides whether to call markdown_editor."""
    llm_with_tools = build_llm()

    # Prepend system prompt + current knowledge base to the conversation
    import datetime
    today = datetime.date.today().isoformat()
    kb = load_knowledge_base()
    system_message = SystemMessage(content=SYSTEM_PROMPT)
    context_message = HumanMessage(content=f"CURRENT DATE: {today}\n\nCURRENT KNOWLEDGE BASE:\n\n{kb}")

    # Build the full message list for this call
    messages = [system_message, context_message] + state["messages"]

    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}

# ToolNode handles actually executing whatever tool the LLM called
tool_node = ToolNode(TOOLS)

# -------------------------------------------------------------------
# Graph
# -------------------------------------------------------------------
def build_state_manager_graph(checkpointer=None):
    workflow = StateGraph(StateManagerState)

    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)

    workflow.set_entry_point("agent")

    # If the LLM returned tool_calls -> run tools, then return to agent
    # If the LLM returned a plain message -> END
    workflow.add_conditional_edges("agent", tools_condition)
    workflow.add_edge("tools", "agent")

    return workflow.compile(checkpointer=checkpointer)

from backend.agents.chat_agent import chat_checkpointer
state_manager_graph = build_state_manager_graph(chat_checkpointer)
