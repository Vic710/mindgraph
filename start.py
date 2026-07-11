import subprocess
import sys
import os
import time
import platform

def start_services():
    print("==================================================")
    print("::: Starting Productivity Agent Workspace :::")
    print("==================================================")
    
    workspace_root = os.path.abspath(os.path.dirname(__file__))
    
    # Determine the python virtual environment executable path based on OS
    is_windows = platform.system() == "Windows"
    if is_windows:
        python_bin = os.path.join(workspace_root, "venv", "Scripts", "python.exe")
    else:
        python_bin = os.path.join(workspace_root, "venv", "bin", "python")
        
    if not os.path.exists(python_bin):
        print(f"[ERROR] Python virtual environment binary not found at {python_bin}")
        print("Please ensure the backend virtual environment is created and configured.")
        sys.exit(1)
        
    backend_script = os.path.join(workspace_root, "backend", "run.py")
    
    # 1. Start backend process
    print("[+] Launching FastAPI backend server...")
    backend_proc = subprocess.Popen([python_bin, backend_script])
    
    # Give the backend a moment to spin up and bind port 8000
    time.sleep(1.5)
    
    # 2. Start frontend dev server
    print("[+] Launching Vite React dev server...")
    frontend_dir = os.path.join(workspace_root, "frontend")
    
    # On Windows, resolve npm path and fallback to PowerShell command if not found in global cmd PATH
    if is_windows:
        import shutil
        if shutil.which("npm") is None:
            frontend_cmd = ["powershell", "-Command", "npm run dev"]
            shell_opt = False
        else:
            frontend_cmd = ["npm", "run", "dev"]
            shell_opt = True
    else:
        frontend_cmd = ["npm", "run", "dev"]
        shell_opt = True

    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
        shell=shell_opt
    )
    
    print("\n[OK] Services launched successfully!")
    print(" - Backend: http://127.0.0.1:8000")
    print(" - Frontend: http://localhost:5173")
    print("Press Ctrl+C to terminate both servers.")
    print("==================================================\n")
    
    try:
        # Loop and check status
        while True:
            # Check if backend or frontend terminated
            if backend_proc.poll() is not None:
                print("[WARN] Backend server terminated.")
                break
            if frontend_proc.poll() is not None:
                print("[WARN] Frontend dev server terminated.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[!] Shutting down services...")
    finally:
        # Kill both processes
        try:
            backend_proc.terminate()
        except Exception:
            pass
        try:
            frontend_proc.terminate()
        except Exception:
            pass
            
        # Wait for them to exit
        backend_proc.wait()
        frontend_proc.wait()
        print("[OK] Services cleanly terminated. Goodbye!")

if __name__ == "__main__":
    start_services()
