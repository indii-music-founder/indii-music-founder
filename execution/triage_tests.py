import re
import sys
from collections import Counter

def triage_log(file_path):
    print(f"Triaging log file: {file_path}")
    try:
        with open(file_path, "r") as f:
            content = f.read()
    except FileNotFoundError:
        print("Error: Log file not found.")
        return

    # Look for common fail patterns
    # Example: FAIL src/__tests__/auth.test.ts
    fails = re.findall(r"FAIL\s+(src\/\S+)", content)
    
    # Look for error messages
    # Example: Error: ...
    errors = re.findall(r"Error: (.*)", content)
    
    print(f"\nTotal Failures: {len(fails)}")
    
    print("\nMost Common Error Messages:")
    error_counts = Counter(errors)
    for err, count in error_counts.most_common(5):
        print(f"  [{count}] {err}")

    print("\nTop Failing Files:")
    file_counts = Counter(fails)
    for file, count in file_counts.most_common(5):
        print(f"  [{count}] {file}")

if __name__ == "__main__":
    log_file = sys.argv[1] if len(sys.argv) > 1 else "test_failures.log"
    triage_log(log_file)
