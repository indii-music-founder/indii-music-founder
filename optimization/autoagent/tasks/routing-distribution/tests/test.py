import sys
import os

def main():
    output = sys.stdin.read().strip().lower()
    
    # Ensure the logs folder exists
    os.makedirs("/logs", exist_ok=True)
    
    # Valid targets for this task: distribution
    if output == "distribution":
        reward = 1.0
        print(f"PASS: Correctly routed to {output}")
    else:
        reward = 0.0
        print(f"FAIL: Routed to '{output}', expected 'distribution'")
        
    with open("/logs/reward.txt", "w") as f:
        f.write(str(reward))
        
    if reward == 1.0:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
