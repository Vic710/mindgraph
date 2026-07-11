import datetime
import shutil
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from backend.config import LIFE_DIR, SNAPSHOTS_DIR, API_SECRET_TOKEN, ALLOWED_ORIGINS
from backend.agents.state_manager import state_manager_graph
from backend.agents.decision_engine import decision_engine_graph
from backend.agents.reflection_agent import reflection_agent_graph
from backend.agents.chat_agent import chat_graph, list_thread_ids, delete_thread_by_id
from backend.agents.logger import log_response, get_logs, delete_log, add_day_log, get_day_logs, delete_day_log
from backend.neon import pull_from_neon, push_to_neon, get_last_synced_at, is_neon_available

def verify_api_token(x_mindgraph_token: str = Header(None)):
    """Global dependency to check for the custom API key header if set in config."""
    if API_SECRET_TOKEN and x_mindgraph_token != API_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing token")

app = FastAPI(
    title="Productivity Agent API",
    dependencies=[Depends(verify_api_token)]
)

# Parse origins list
origins = [origin.strip() for origin in ALLOWED_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    """On every server start, pull the latest state from Neon (if configured)."""
    result = pull_from_neon()
    if result.get("skipped"):
        print("[Startup] Neon pull skipped — running in local-only mode.")
    elif result.get("error"):
        print(f"[Startup] Neon pull error: {result['error']}")
    else:
        print(f"[Startup] Neon pull OK: {result}")

# ------------------------------------------------------------------ #
# Request Schemas
# ------------------------------------------------------------------ #
class FileUpdateRequest(BaseModel):
    content: str

class AgentRequest(BaseModel):
    text: str   # User's input message

class DayLogRequest(BaseModel):
    note: str

# ------------------------------------------------------------------ #
# File Endpoints
# ------------------------------------------------------------------ #
@app.get("/api/files")
def list_files():
    """List all the markdown source files in the life/ folder."""
    files_list = []
    for item in sorted(LIFE_DIR.glob("*.md")):
        if item.is_file():
            stat = item.stat()
            title = item.name
            try:
                first_line = item.read_text(encoding="utf-8").splitlines()[0].strip()
                if first_line.startswith("#"):
                    title = first_line.lstrip("# ").strip()
            except Exception:
                pass
            files_list.append({
                "name": item.name,
                "title": title,
                "last_modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size": stat.st_size
            })

    def sort_key(f):
        try:
            return int(f["name"].split("_")[0])
        except ValueError:
            return 99

    files_list.sort(key=sort_key)
    return files_list

@app.get("/api/files/{name}")
def get_file(name: str):
    """Retrieve content of a specific markdown file."""
    file_path = LIFE_DIR / name
    if not file_path.is_file() or file_path.parent != LIFE_DIR:
        raise HTTPException(status_code=404, detail="File not found")
    return {"name": name, "content": file_path.read_text(encoding="utf-8")}

@app.put("/api/files/{name}")
def update_file(name: str, payload: FileUpdateRequest):
    """Manually overwrite a markdown file (used by File Explorer editor)."""
    file_path = LIFE_DIR / name
    if file_path.parent != LIFE_DIR:
        raise HTTPException(status_code=400, detail="Invalid file path")
    file_path.write_text(payload.content, encoding="utf-8")
    return {"status": "success", "message": f"{name} updated successfully"}

@app.post("/api/files/snapshot")
def create_snapshot():
    """Copy all life/ files to snapshots/YYYY-MM-DD/."""
    today_str = datetime.date.today().isoformat()
    target_dir = SNAPSHOTS_DIR / today_str
    if target_dir.exists():
        time_str = datetime.datetime.now().strftime("%H-%M-%S")
        target_dir = SNAPSHOTS_DIR / f"{today_str}_{time_str}"
    target_dir.mkdir(parents=True, exist_ok=True)

    copied = []
    for item in LIFE_DIR.glob("*.md"):
        if item.is_file():
            shutil.copy2(item, target_dir / item.name)
            copied.append(item.name)
    return {"status": "success", "directory": target_dir.name, "files": copied}

# ------------------------------------------------------------------ #
# Helper Functions
# ------------------------------------------------------------------ #
def get_message_text(message) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_blocks = []
        for block in content:
            if isinstance(block, dict) and "text" in block:
                text_blocks.append(block["text"])
            elif isinstance(block, str):
                text_blocks.append(block)
        return "".join(text_blocks)
    return str(content)

# ------------------------------------------------------------------ #
# Agent Endpoints
# ------------------------------------------------------------------ #
@app.post("/api/state/update")
def run_state_manager(payload: AgentRequest):
    """
    Invoke the State Manager agent.
    Today's day logger notes are automatically prepended as context before the user prompt.
    The agent uses the markdown_editor tool to directly write updated files to disk.
    Returns the agent's final response text.
    """
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty")
    try:
        # Inject today's day logger notes as supplementary context
        today = datetime.date.today().isoformat()
        day_logs = get_day_logs(today)
        augmented_text = payload.text
        if day_logs:
            notes_block = "DAY LOGGER NOTES (timestamped notes I jotted throughout the day — use as context):\n"
            for entry in day_logs:
                # Convert UTC ISO timestamp to a readable time
                try:
                    dt = datetime.datetime.fromisoformat(entry["created_at"])
                    time_str = dt.strftime("%H:%M UTC")
                except Exception:
                    time_str = entry["created_at"]
                notes_block += f"  [{time_str}] {entry['note']}\n"
            augmented_text = f"{notes_block}\nUSER UPDATE:\n{payload.text}"

        result = state_manager_graph.invoke({
            "messages": [HumanMessage(content=augmented_text)]
        })
        final_message = result["messages"][-1]
        response_text = get_message_text(final_message)
        log_response("state_manager", payload.text, response_text)
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------------------ #
# Day Logger Endpoints
# ------------------------------------------------------------------ #
@app.post("/api/daylog")
def create_day_log(payload: DayLogRequest):
    """Save a new timestamped note for today."""
    if not payload.note.strip():
        raise HTTPException(status_code=400, detail="Note cannot be empty")
    try:
        entry = add_day_log(payload.note)
        return entry
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/daylog")
def list_day_logs(date: str = None):
    """
    Return all day log notes for a given date (YYYY-MM-DD).
    Defaults to today (UTC) if no date param provided.
    """
    try:
        logs = get_day_logs(date)
        return {"logs": logs, "date": date or datetime.date.today().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/daylog/{log_id}")
def remove_day_log(log_id: int):
    """Delete a single day log note by id."""
    try:
        delete_day_log(log_id)
        return {"status": "deleted", "id": log_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/decision/generate")
def run_decision_engine(payload: AgentRequest):
    """
    Invoke the Decision Engine agent.
    Returns a markdown-formatted decision plan.
    """
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty")
    try:
        result = decision_engine_graph.invoke({
            "messages": [HumanMessage(content=payload.text)]
        })
        final_message = result["messages"][-1]
        response_text = get_message_text(final_message)
        log_response("decision_engine", payload.text, response_text)
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reflection/generate")
def run_reflection_agent(payload: AgentRequest):
    """
    Invoke the Reflection Agent.
    Typically run on Sundays. Input is optional context or just 'run'.
    Returns a markdown-formatted reflection analysis.
    """
    try:
        result = reflection_agent_graph.invoke({
            "messages": [HumanMessage(content=payload.text or "Run weekly reflection.")]
        })
        final_message = result["messages"][-1]
        response_text = get_message_text(final_message)
        log_response("reflection", payload.text or "Run weekly reflection.", response_text)
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------------------------------------------------------ #
# Agent Log Endpoints
# ------------------------------------------------------------------ #
@app.get("/api/logs")
def list_logs(agent: str = None, limit: int = 30):
    """
    Return stored agent responses.
    Optional query param: ?agent=state_manager|decision_engine|reflection
    """
    return {"logs": get_logs(agent=agent, limit=limit)}

@app.delete("/api/logs/{log_id}")
def remove_log(log_id: int):
    """Delete a specific log entry by id."""
    try:
        delete_log(log_id)
        return {"status": "deleted", "id": log_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    thread_id: str          # UUID identifying the conversation
    message: str            # User's latest message

@app.post("/api/chat")
def chat(payload: ChatRequest):
    """
    Send a message to the personal chat agent.
    - First message in a thread automatically receives life context.
    - Subsequent messages use stored history from SQLite.
    - New conversation = new thread_id (generate UUID on client).
    """
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    try:
        from langchain_core.messages import HumanMessage
        config = {"configurable": {"thread_id": payload.thread_id}}
        result = chat_graph.invoke(
            {"messages": [HumanMessage(content=payload.message)]},
            config=config
        )
        final_msg = result["messages"][-1]
        response_text = get_message_text(final_msg)
        return {
            "thread_id": payload.thread_id,
            "response": response_text,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/chat/threads")
def list_threads():
    """
    Returns a list of stored conversation thread IDs.
    Works with both PostgresSaver (Neon) and SqliteSaver (local).
    """
    try:
        threads = list_thread_ids()
        return {"threads": threads}
    except Exception:
        return {"threads": []}

@app.delete("/api/chat/{thread_id}")
def delete_thread(thread_id: str):
    """Delete all messages for a given conversation thread."""
    try:
        delete_thread_by_id(thread_id)
        return {"status": "deleted", "thread_id": thread_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------------------------------ #
# Neon Sync Endpoints
# ------------------------------------------------------------------ #
@app.post("/api/neon/push")
def neon_push():
    """
    Push all local data to Neon: markdown files, agent_logs, day_logs.
    Chat history is already persisted directly in Neon via PostgresSaver.
    """
    result = push_to_neon()
    if result.get("skipped"):
        raise HTTPException(status_code=503, detail="DATABASE_URL not configured. Neon sync unavailable.")
    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@app.get("/api/neon/status")
def neon_status():
    """Return Neon sync availability and last push timestamp."""
    return {
        "available": is_neon_available(),
        "last_synced_at": get_last_synced_at(),
    }
