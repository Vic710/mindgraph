import sys
import os

# Add parent dir to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.agents.memory_manager import memory_manager_graph
from backend.agents.planner import planner_graph
from backend.config import GEMINI_API_KEY

def test_compilation():
    print("Checking Memory Manager Graph...")
    mm_graph = memory_manager_graph
    print("Memory Manager Graph compiled successfully.")
    
    print("\nChecking Planner Graph...")
    p_graph = planner_graph
    print("Planner Graph compiled successfully.")
    
    print(f"\nGEMINI_API_KEY Configured: {'Yes' if GEMINI_API_KEY else 'No (Make sure to configure it in .env before running)'}")
    
    # Simple check on nodes
    print("\nMemory Manager Nodes:")
    for node in mm_graph.nodes:
        print(f" - {node}")
        
    print("\nPlanner Nodes:")
    for node in p_graph.nodes:
        print(f" - {node}")

if __name__ == "__main__":
    test_compilation()
