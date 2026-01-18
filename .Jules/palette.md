## 2024-05-23 - Test File Overwriting
**Learning:** Always verify if a test file exists before creating it, even if `list_files` on the parent directory missed it (or I missed it in the output). Overwriting existing test files destroys valuable functional tests.
**Action:** Use `list_files` on the specific subdirectory (e.g., `src/modules/onboarding/pages/`) before creating a file like `OnboardingPage.test.tsx`.
