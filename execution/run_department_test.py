#!/usr/bin/env python3
"""
run_department_test.py - Scoped Department Test Runner for indii.

Usage:
  python3 execution/run_department_test.py <department> [options]

Examples:
  python3 execution/run_department_test.py marketing
  python3 execution/run_department_test.py marketing --unit-only
  python3 execution/run_department_test.py marketing --dry-run
"""

import argparse
import json
import os
import subprocess
import sys
from typing import List, Dict, Any, Optional

CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", ".agent", "test_ledger", "departments_test_config.json"
)

# Colors for terminal output
COLOR_RESET = "\033[0m"
COLOR_BOLD = "\033[1m"
COLOR_RED = "\033[31m"
COLOR_GREEN = "\033[32m"
COLOR_YELLOW = "\033[33m"
COLOR_BLUE = "\033[34m"
COLOR_CYAN = "\033[36m"


def load_config() -> Dict[str, Any]:
    """Loads the department testing configuration registry."""
    if not os.path.exists(CONFIG_PATH):
        print(f"{COLOR_RED}Error: Configuration file not found at {CONFIG_PATH}{COLOR_RESET}")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def find_department(config: Dict[str, Any], query: str) -> Optional[tuple]:
    """Finds a department key and configuration matching the query (supporting aliases)."""
    query_lower = query.lower().strip()
    for key, dept_data in config.items():
        if query_lower == key.lower():
            return key, dept_data
        aliases = dept_data.get("aliases", [])
        if any(query_lower == alias.lower() for alias in aliases):
            return key, dept_data
    return None


def run_command(command: List[str], cwd: str) -> bool:
    """Executes a shell command and streams output. Returns True if successful."""
    print(f"\n{COLOR_CYAN}{COLOR_BOLD}Executing command:{COLOR_RESET} {' '.join(command)}")
    try:
        # Run subprocess and stream to stdout/stderr in real time
        result = subprocess.run(
            command,
            cwd=cwd,
            stdout=sys.stdout,
            stderr=sys.stderr,
            text=True,
            check=False
        )
        return result.returncode == 0
    except Exception as e:
        print(f"{COLOR_RED}Execution failed: {e}{COLOR_RESET}")
        return False


def has_test_files(path: str, base_dir: str) -> bool:
    """Returns True if the path is a test file or a directory containing at least one test file recursively."""
    full_path = os.path.join(base_dir, path)
    if not os.path.exists(full_path):
        return False
    
    if os.path.isfile(full_path):
        name = os.path.basename(full_path).lower()
        return ".test." in name or ".spec." in name
        
    # If directory, walk and look for test files
    for root, _, files in os.walk(full_path):
        for f in files:
            name = f.lower()
            if (".test.ts" in name or ".test.tsx" in name or 
                ".spec.ts" in name or ".spec.tsx" in name):
                return True
    return False


def get_existing_paths(paths: List[str], base_dir: str) -> List[str]:
    """Filters paths to only include those that actually exist on disk and contain test files."""
    existing = []
    for path in paths:
        full_path = os.path.join(base_dir, path)
        if os.path.exists(full_path):
            # For unitTestPaths, we verify actual test files exist to prevent Vitest failing on empty directories
            # If path ends with .spec.ts or .spec.tsx, it's an E2E spec which is a file and has_test_files handles it
            if has_test_files(path, base_dir):
                existing.append(path)
            else:
                print(f"{COLOR_YELLOW}Warning: Path exists but contains no unit/integration test files: {path}{COLOR_RESET}")
        else:
            print(f"{COLOR_YELLOW}Warning: Path does not exist and will be skipped: {path}{COLOR_RESET}")
    return existing


def get_existing_files(paths: List[str], base_dir: str, label: str) -> List[str]:
    """Filters paths to only include existing files for non-Vitest checks."""
    existing = []
    for path in paths:
        full_path = os.path.join(base_dir, path)
        if os.path.isfile(full_path):
            existing.append(path)
        else:
            print(f"{COLOR_YELLOW}Warning: {label} file does not exist and will be skipped: {path}{COLOR_RESET}")
    return existing


def main():
    parser = argparse.ArgumentParser(description="Run unit and E2E tests scoped by sidebar category (department, tool, manager, project) and connected integrations.")
    parser.add_argument("target", help="The sidebar item name or alias to test (e.g., marketing, audio-analyzer, brand, dashboard)")
    parser.add_argument("--dry-run", action="store_true", help="Print the tests that would be run without executing them")
    parser.add_argument("--unit-only", action="store_true", help="Only run Vitest unit/integration tests")
    parser.add_argument("--e2e-only", action="store_true", help="Only run Playwright E2E tests (including connections)")
    parser.add_argument("--python-only", action="store_true", help="Only run configured Python syntax/dependency checks")
    parser.add_argument("--no-connections", action="store_true", help="Do not run connected integration tests")
    
    args = parser.parse_args()
    
    config = load_config()
    match = find_department(config, args.target)
    
    if not match:
        print(f"\n{COLOR_RED}{COLOR_BOLD}Error: Sidebar target or alias '{args.target}' not found.{COLOR_RESET}")
        print("\nAvailable Targets and Aliases:")
        for key, dept_data in config.items():
            category = dept_data.get("category", "department")
            aliases_str = ", ".join(dept_data.get('aliases', []))
            print(f"  - {COLOR_BOLD}{dept_data.get('name')}{COLOR_RESET} [{category}] (key: '{key}', aliases: [{aliases_str}])")
        sys.exit(1)
        
    dept_key, dept_data = match
    category_label = dept_data.get("category", "department").upper()
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    print(f"\n{COLOR_BLUE}{COLOR_BOLD}============================================================{COLOR_RESET}")
    print(f"{COLOR_BLUE}{COLOR_BOLD} TESTING {category_label}: {dept_data.get('name').upper()}{COLOR_RESET}")
    print(f"{COLOR_BLUE}{COLOR_BOLD}============================================================{COLOR_RESET}")
    
    # 1. Resolve Unit Test Paths
    unit_paths = get_existing_paths(dept_data.get("unitTestPaths", []), project_root)
    
    # 2. Resolve E2E Specs
    e2e_specs = get_existing_paths(dept_data.get("e2eTestPaths", []), project_root)
    connected_e2e_specs = []
    if not args.no_connections:
        connected_e2e_specs = get_existing_paths(dept_data.get("connectedE2eTestPaths", []), project_root)
        
    all_e2e_specs = e2e_specs + connected_e2e_specs

    # 3. Resolve Python dependency/syntax checks
    python_paths = get_existing_files(dept_data.get("pythonTestPaths", []), project_root, "Python check")
    
    # Check dry run
    if args.dry_run:
        print(f"\n{COLOR_YELLOW}{COLOR_BOLD}[DRY RUN SUMMARY]{COLOR_RESET}")
        print(f"Target key resolved: {dept_key} (Category: {category_label.lower()})")
        print(f"Unit Test Directories:")
        for path in unit_paths:
            print(f"  - {path}")
        print(f"Core E2E Spec Files:")
        for spec in e2e_specs:
            print(f"  - {spec}")
        if connected_e2e_specs:
            print(f"Connected Integration E2E Spec Files:")
            for spec in connected_e2e_specs:
                print(f"  - {spec}")
        if python_paths:
            print(f"Python Audio/Dependency Check Files:")
            for path in python_paths:
                print(f"  - {path}")
        if dept_data.get("fixturePaths"):
            print(f"Audio Fixture Files:")
            for path in dept_data.get("fixturePaths", []):
                exists = "found" if os.path.exists(os.path.join(project_root, path)) else "missing"
                print(f"  - {path} [{exists}]")
        if dept_data.get("manualBrowserRoutes"):
            print(f"Manual Browser Acceptance Routes:")
            for route in dept_data.get("manualBrowserRoutes", []):
                print(f"  - {route}")
        if dept_data.get("coverageChecklist"):
            print(f"Coverage Checklist:")
            for item in dept_data.get("coverageChecklist", []):
                print(f"  - {item}")
        print(f"\nWould run commands:")
        if not args.e2e_only and not args.python_only and unit_paths:
            print(f"  npm run test -- --run {' '.join(unit_paths)}")
        if not args.unit_only and not args.python_only and all_e2e_specs:
            print(f"  npx playwright test {' '.join(all_e2e_specs)}")
        if not args.unit_only and not args.e2e_only and python_paths:
            print(f"  python3 -m py_compile {' '.join(python_paths)}")
        sys.exit(0)
        
    unit_success = True
    e2e_success = True
    python_success = True
    
    # Run Unit Tests
    if not args.e2e_only and not args.python_only:
        if unit_paths:
            print(f"\n{COLOR_CYAN}{COLOR_BOLD}--- Running Unit & Integration Tests ---{COLOR_RESET}")
            cmd = ["npm", "run", "test", "--", "--run"] + unit_paths
            unit_success = run_command(cmd, project_root)
        else:
            print(f"\n{COLOR_YELLOW}No unit tests configured or found for this {category_label.lower()}.{COLOR_RESET}")
            
    # Run E2E Tests
    if not args.unit_only and not args.python_only:
        if all_e2e_specs:
            print(f"\n{COLOR_CYAN}{COLOR_BOLD}--- Running E2E & Connected Feature Tests ---{COLOR_RESET}")
            cmd = ["npx", "playwright", "test"] + all_e2e_specs
            e2e_success = run_command(cmd, project_root)
        else:
            print(f"\n{COLOR_YELLOW}No E2E tests configured or found for this {category_label.lower()}.{COLOR_RESET}")

    # Run Python Checks
    if not args.unit_only and not args.e2e_only:
        if python_paths:
            print(f"\n{COLOR_CYAN}{COLOR_BOLD}--- Running Python Syntax & Dependency Surface Checks ---{COLOR_RESET}")
            cmd = ["python3", "-m", "py_compile"] + python_paths
            python_success = run_command(cmd, project_root)
        elif args.python_only:
            print(f"\n{COLOR_YELLOW}No Python checks configured or found for this {category_label.lower()}.{COLOR_RESET}")
            
    # Final Report
    print(f"\n{COLOR_BLUE}{COLOR_BOLD}============================================================{COLOR_RESET}")
    print(f"{COLOR_BLUE}{COLOR_BOLD} {category_label} TEST RESULTS SUMMARY: {dept_data.get('name').upper()}{COLOR_RESET}")
    print(f"{COLOR_BLUE}{COLOR_BOLD}============================================================{COLOR_RESET}")
    
    overall_success = True
    
    if not args.e2e_only and not args.python_only:
        status_str = f"{COLOR_GREEN}PASS{COLOR_RESET}" if unit_success else f"{COLOR_RED}FAIL{COLOR_RESET}"
        print(f"Unit Tests: {status_str}")
        if not unit_success:
            overall_success = False
            
    if not args.unit_only and not args.python_only:
        status_str = f"{COLOR_GREEN}PASS{COLOR_RESET}" if e2e_success else f"{COLOR_RED}FAIL{COLOR_RESET}"
        print(f"E2E Tests:  {status_str}")
        if not e2e_success:
            overall_success = False

    if not args.unit_only and not args.e2e_only:
        status_str = f"{COLOR_GREEN}PASS{COLOR_RESET}" if python_success else f"{COLOR_RED}FAIL{COLOR_RESET}"
        print(f"Python Checks: {status_str}")
        if not python_success:
            overall_success = False
            
    if overall_success:
        print(f"\n{COLOR_GREEN}{COLOR_BOLD}✅ Scoped {category_label.capitalize()} Testing Passed!{COLOR_RESET}\n")
        sys.exit(0)
    else:
        print(f"\n{COLOR_RED}{COLOR_BOLD}❌ Scoped {category_label.capitalize()} Testing Failed!{COLOR_RESET}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
