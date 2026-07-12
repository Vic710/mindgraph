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
class DecisionEngineState(TypedDict):
    messages: Annotated[list, add_messages]

# -------------------------------------------------------------------
# System Prompt
# -------------------------------------------------------------------
SYSTEM_PROMPT = """You are the user's Decision Engine.

Your job is to decide what the user should do.

The Markdown files describe the user's current state.
Treat them as truth. Never modify them.

Your objective is to maximize long-term progress toward the user's North Star goals.

When generating a plan or schedule:
- Provide a holistic, realistic day plan that accounts for study, preparation, and internship tasks, but also maps basic self-care and health goals (such as scheduling specific slots for gym, meals/food, wind-down time, and proper sleep).
- Treat health as a non-negotiable priority alongside placement tasks.
- Format the final schedule as a clean, easy-to-read chronological list, assigning explicit time blocks.
- Stick strictly to direct advice and scheduling. No conversational filler, analogies, or excessive justifications.

When making recommendations consider:
- Deadlines
- Available time
- Energy level
- Current commitments
- Opportunity cost
- Long-term impact
- The user's principles

Prefer work with the highest long-term return.
Recommend fewer high-impact tasks rather than many small ones.
Avoid busywork.
Avoid recommending tasks that contradict the user's priorities.

When tradeoffs exist, explain why one option is better.

If scheduling is requested:
1. Decide priorities.
2. Allocate realistic time.
3. Leave buffer time.
4. Include breaks when appropriate.

Do not change long-term goals.
Do not update Markdown files.
You are responsible only for decision making.

## How to behave
- Be highly concise and direct. Do not yap, over-explain, or add unnecessary analogies/fluff unless requested.
- Just tell the user the generated plan, decisions, or what they need to do clearly.
- Keep any reasoning or explanations extremely short and focused."""

# -------------------------------------------------------------------
# Node
# -------------------------------------------------------------------
def load_decision_context() -> str:
    """Reads exactly the 5 files the Decision Engine uses."""
    required_files = [
        "0_context.md", "1_goals.md", "3_current_state.md",
        "4_decisions.md", "8_principles.md"
    ]
    sections = []
    for filename in required_files:
        filepath = LIFE_DIR / filename
        if filepath.is_file():
            try:
                content = filepath.read_text(encoding="utf-8")
                sections.append(f"--- FILE: {filename} ---\n{content}")
            except Exception as e:
                sections.append(f"--- FILE: {filename} ---\nError reading: {e}")
    return "\n\n".join(sections)

def agent_node(state: DecisionEngineState) -> Dict[str, Any]:
    """Calls the LLM without tools. The Decision Engine only responds — never edits files."""
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=GEMINI_API_KEY,
        temperature=0.3
    )

    context = load_decision_context()
    system_message = SystemMessage(content=SYSTEM_PROMPT)
    context_message = HumanMessage(content=f"USER STATE OF TRUTH:\n\n{context}")

    messages = [system_message, context_message] + state["messages"]
    response = llm.invoke(messages)
    return {"messages": [response]}

# -------------------------------------------------------------------
# Graph (no tools, just agent -> END)
# -------------------------------------------------------------------
def build_decision_engine_graph(checkpointer=None):
    workflow = StateGraph(DecisionEngineState)
    workflow.add_node("agent", agent_node)
    workflow.set_entry_point("agent")
    workflow.add_edge("agent", END)
    return workflow.compile(checkpointer=checkpointer)

from backend.agents.chat_agent import chat_checkpointer
decision_engine_graph = build_decision_engine_graph(chat_checkpointer)
