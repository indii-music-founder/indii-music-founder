import json
import logging
import re
import sys
from collections import Counter
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_triage")

class TestTriageSystem:
    """Analyzes test logs to identify patterns in failures and errors.

    Specifically tuned for Vitest and standard TypeScript/JavaScript error patterns.
    """

    def __init__(self, log_path: str):
        """Initializes the triage system.

        Args:
            log_path: Path to the log file containing test output.
        """
        self.log_path = log_path

    def analyze(self) -> Dict[str, Any]:
        """Performs regex-based analysis on the log file.

        Returns:
            A report dictionary with summarized failure metrics.
        """
        logger.info(f"Analyzing log file: {self.log_path}")
        
        try:
            with open(self.log_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except FileNotFoundError:
            logger.error(f"Triage Error: Log file not found at {self.log_path}")
            return {"error": "Log file not found"}

        # Regex patterns for Vitest/Jest/NPM errors
        fail_files_pattern = r"FAIL\s+(\S+)"
        vitest_errors_pattern = r"\[vitest\] (.*)"
        type_errors_pattern = r"TypeError: (.*)"
        general_errors_pattern = r"Error: (.*)"
        syntax_errors_pattern = r"SyntaxError: (.*)"

        fails = re.findall(fail_files_pattern, content)
        errors = (
            re.findall(vitest_errors_pattern, content) +
            re.findall(type_errors_pattern, content) +
            re.findall(general_errors_pattern, content) +
            re.findall(syntax_errors_pattern, content)
        )

        file_breakdown = Counter(fails)
        error_breakdown = Counter(errors)

        report = {
            "summary": {
                "total_failures": len(fails),
                "unique_failing_files": len(file_breakdown),
                "unique_error_messages": len(error_breakdown)
            },
            "top_failing_files": [
                {"file": f, "count": c} for f, c in file_breakdown.most_common(10)
            ],
            "top_error_messages": [
                {"message": m, "count": c} for m, c in error_breakdown.most_common(10)
            ]
        }

        return report

def print_triage_report(report: Dict[str, Any]) -> None:
    """Prints a human-readable summary of the triage report."""
    if "error" in report:
        print(f"Error: {report['error']}")
        return

    print("\n" + "="*60)
    print(" INDUSTRIAL TEST TRIAGE REPORT ")
    print("="*60)
    print(f"Total Test Failures: {report['summary']['total_failures']}")
    print(f"Failing Files:       {report['summary']['unique_failing_files']}")
    print("-" * 60)
    
    print("\n[ TOP FAILING FILES ]")
    for item in report["top_failing_files"]:
        print(f"  ({item['count']}) {item['file']}")
        
    print("\n[ TOP ERROR PATTERNS ]")
    for item in report["top_error_messages"]:
        print(f"  ({item['count']}) {item['message']}")
    print("="*60 + "\n")

if __name__ == "__main__":
    target_log = sys.argv[1] if len(sys.argv) > 1 else "test_failures.log"
    
    triager = TestTriageSystem(target_log)
    analysis_report = triager.analyze()
    
    # Check for CLI flag for raw JSON output
    if "--json" in sys.argv:
        print(json.dumps(analysis_report, indent=2))
    else:
        print_triage_report(analysis_report)
