#!/usr/bin/env python3
"""
run_full_menu_gauntlet.py - Iterates through all sidebar targets from top to bottom
and runs their scoped test suites sequentially, compiling a consolidated quality report.

Usage:
  python3 execution/run_full_menu_gauntlet.py [options]
"""

import argparse
import datetime
import json
import os
import subprocess
import sys
import time
from typing import Dict, Any, List

CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", ".agent", "test_ledger", "departments_test_config.json"
)
REPORTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "artifacts"))


def load_config() -> Dict[str, Any]:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def main():
    parser = argparse.ArgumentParser(description="Run full sidebar menu stress test gauntlet from top to bottom.")
    parser.add_argument("--unit-only", action="store_true", help="Only run Vitest unit tests")
    parser.add_argument("--e2e-only", action="store_true", help="Only run Playwright E2E tests")
    parser.add_argument("--dry-run", action="store_true", help="Perform dry-run to show sequence and targets")
    args = parser.parse_args()

    config = load_config()
    os.makedirs(REPORTS_DIR, exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    report_filename = f"menu_gauntlet_report_{timestamp}.md"
    report_path = os.path.join(REPORTS_DIR, report_filename)
    
    print("\nStarting Full Sidebar Menu Gauntlet Stress Test...")
    print(f"Loading config containing {len(config)} targets.")
    
    ordered_keys = [
        "brand", "road", "campaign", "agent", "publicist", "creative",
        "marketing", "social", "legal", "publishing", "finance", "distribution",
        "licensing", "merch", "registration", "security",
        "workflow", "audio-analyzer", "knowledge", "memory", "observability", "settings",
        "mobile-remote", "dashboard", "boardroom", "founders", "onboarding"
    ]
    
    # Filter config keys in correct order
    test_sequence = [key for key in ordered_keys if key in config]
    # Add any leftover config keys not explicitly ordered
    for key in config:
        if key not in test_sequence:
            test_sequence.append(key)
            
    if args.dry_run:
        print("\n[DRY RUN] Sequence of tests to run (Top to Bottom):")
        for idx, key in enumerate(test_sequence, 1):
            category = config[key].get("category", "unknown").upper()
            print(f"  {idx:02d}. {COLOR_BOLD}{config[key].get('name')}{COLOR_RESET} [{category}] (key: '{key}')")
        sys.exit(0)
        
    start_time = time.time()
    results = []
    
    for idx, key in enumerate(test_sequence, 1):
        dept_data = config[key]
        category = dept_data.get("category", "unknown").upper()
        print(f"\n[{idx}/{len(test_sequence)}] Running tests for {category}: {dept_data.get('name')}...")
        
        # Build command
        cmd = ["python3", "execution/run_department_test.py", key]
        if args.unit_only:
            cmd.append("--unit-only")
        elif args.e2e_only:
            cmd.append("--e2e-only")
            
        print(f"Command: {' '.join(cmd)}")
        cmd_start = time.time()
        
        # Run subprocess
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False
        )
        duration = time.time() - cmd_start
        passed = result.returncode == 0
        
        results.append({
            "key": key,
            "name": dept_data.get("name"),
            "category": category,
            "passed": passed,
            "duration": duration,
            "output": result.stdout
        })
        
        status_str = "PASS" if passed else "FAIL"
        print(f"Finished {dept_data.get('name')}: {status_str} (took {duration:.2f}s)")
        
    total_duration = time.time() - start_time
    
    # Generate Markdown Report
    passed_count = sum(1 for r in results if r["passed"])
    failed_count = len(results) - passed_count
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# Full Sidebar Menu Gauntlet Execution Report\n\n")
        f.write(f"- **Date:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **Total Duration:** {total_duration/60:.2f} minutes\n")
        f.write(f"- **Summary:** {passed_count} / {len(results)} passed ({passed_count/len(results)*100:.1f}%)\n\n")
        
        f.write("## Status Grid\n\n")
        f.write("| # | Category | Target Name | Key | Status | Duration |\n")
        f.write("|---|----------|-------------|-----|--------|----------|\n")
        for idx, r in enumerate(results, 1):
            status_emoji = "✅ PASS" if r["passed"] else "❌ FAIL"
            f.write(f"| {idx} | {r['category']} | {r['name']} | `{r['key']}` | {status_emoji} | {r['duration']:.1f}s |\n")
            
        f.write("\n## Detail Failures\n\n")
        failures = [r for r in results if not r["passed"]]
        if not failures:
            f.write("🎉 **All scoped tests passed! No failures detected.**\n")
        else:
            for r in failures:
                f.write(f"### ❌ {r['category']}: {r['name']} (`{r['key']}`)\n\n")
                f.write(f"**Duration:** {r['duration']:.2f}s\n\n")
                f.write("**Execution Output:**\n")
                f.write("```text\n")
                # Write last 40 lines of output to keep report readable
                lines = r["output"].splitlines()
                last_lines = lines[-40:] if len(lines) > 40 else lines
                f.write("\n".join(last_lines) + "\n")
                f.write("```\n\n")
                
    print(f"\nGauntlet completed! Report saved to {report_path}")
    print(f"Summary: {passed_count}/{len(results)} passed.")
    
    if failed_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)


# Colors stub for console
COLOR_RESET = "\033[0m"
COLOR_BOLD = "\033[1m"

if __name__ == "__main__":
    main()
