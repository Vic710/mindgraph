# Productivity Agent Dashboard (LangGraph + React)

An agentic productivity cockpit powered by LangGraph and Gemini. It manages a personal "source of truth" (a set of 9 markdown files located in `backend/life/`) and assists in daily scheduling, task prioritization, and structured long-term memory updates.

---

## Folder Structure

- **`backend/`**: FastAPI API server.
  - **`agents/`**: LangGraph workflows for the **Memory Manager** and **Planner**.
  - **`life/`**: The 9 core markdown files representing your brain's source of truth.
  - **`life/snapshots/`**: Archived history of monthly/daily snapshots.
- **`frontend/`**: Vite + React single page app styled with premium Glassmorphic Vanilla CSS.
  - **`src/components/DiffViewer.jsx`**: Visual side-by-side and line diff renderer for proposed markdown updates.
  - **`src/App.jsx`**: Dashboard views and agent interaction panels.
- **`start.py`**: A cross-platform master runner script.

---

## Getting Started

### 1. Setup Environment
Ensure you have Python 3.10+ and Node.js v18+ installed. 

Create a `.env` file in the project root and add your Gemini API Key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Run the Application
Start the frontend and backend concurrently with a single command from the root directory:
```bash
python start.py
```

This will spin up:
- **FastAPI Backend Server**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Vite React Dev Server**: [http://localhost:5173](http://localhost:5173)

Open your browser to [http://localhost:5173](http://localhost:5173) to see the dashboard.

---

## Agentic Workflows

### 🧠 Chat 1 — Memory Manager Agent
- **Purpose**: Maintain the state of your markdown files.
- **Action**: Paste your daily updates, weekly reflections, or technical decisions in the text area. 
- **Under the Hood**: LangGraph reads the raw update, loads the existing `life/` files, uses Gemini to analyze changes, and generates the proposed updates.
- **Applying**: Review the changes side-by-side with a colored diff, and click **"Apply Changes"** to write them directly to your local files.

### 📅 Chat 2 — Daily Planner Agent
- **Purpose**: Decide what tasks to tackle today.
- **Action**: Input your energy level, commitments/meetings, and available hours.
- **Under the Hood**: LangGraph reads your identity context (`0_context.md`), quarterly/yearly goals (`1_goals.md`), and active blockers (`3_current_state.md`), and prompts Gemini to prioritize items.
- **Result**: View today's checklist of top priorities, an hourly suggested timeline schedule, and a strategic tradeoff explanation (what *not* to do and why).

### 📁 Markdown Brain Editor
- **Purpose**: Manual override.
- **Action**: Browse all 9 source of truth files. Toggle between "Edit Code" (raw markdown) and "View Preview" (live HTML rendering) to modify files manually.
- **Snapshot**: Click **"Snapshot Brain"** in the sidebar footer to copy all current markdown files to `backend/life/snapshots/YYYY-MM-DD/` to archive your state.
