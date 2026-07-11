from typing import Dict, List, Any, Annotated
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict
from backend.config import LIFE_DIR, GEMINI_API_KEY, GEMINI_MODEL

# -------------------------------------------------------------------
# Agent State
# -------------------------------------------------------------------
class ReflectionAgentState(TypedDict):
    messages: Annotated[list, add_messages]

# -------------------------------------------------------------------
# System Prompt
# -------------------------------------------------------------------
SYSTEM_PROMPT = """You are the user's Reflection Agent.

You run once a week — on Sundays.

Your only job is to read the user's daily logs and help them learn from the past week.

Specifically, you must:
1. Find behavioral or performance patterns from the daily logs.
2. Detect recurring bottlenecks or blockers.
3. Suggest exactly ONE improvement to focus on next week.
4. Suggest exactly ONE new principle worth remembering — only if clearly earned.

Format your response clearly:

**Patterns:**
- ...

**Bottlenecks:**
- ...

**Suggested Improvement:**
...

**Suggested Principle:**
...

You do NOT plan. You do NOT schedule. You do NOT update any files.
You only help the user learn."""

# -------------------------------------------------------------------
# Node
# -------------------------------------------------------------------
def load_daily_log() -> str:
    """Reads 5_daily_log.md for the Reflection Agent."""
    filepath = LIFE_DIR / "5_daily_log.md"
    if filepath.is_file():
        try:
            return filepath.read_text(encoding="utf-8")
        except Exception as e:
            return f"Error reading daily log: {e}"
    return "No daily log entries found."

def agent_node(state: ReflectionAgentState) -> Dict[str, Any]:
    """Calls the LLM without tools. Reflection Agent only reads logs and responds."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=GEMINI_API_KEY,
        temperature=0.3
    )

    daily_log = load_daily_log()
    system_message = SystemMessage(content=SYSTEM_PROMPT)
    context_message = HumanMessage(
        content=f"DAILY LOG FOR ANALYSIS:\n\n{daily_log}"
    )

    messages = [system_message, context_message] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

# -------------------------------------------------------------------
# Graph
# -------------------------------------------------------------------
def build_reflection_agent_graph():
    workflow = StateGraph(ReflectionAgentState)
    workflow.add_node("agent", agent_node)
    workflow.set_entry_point("agent")
    workflow.add_edge("agent", END)
    return workflow.compile()

reflection_agent_graph = build_reflection_agent_graph()
