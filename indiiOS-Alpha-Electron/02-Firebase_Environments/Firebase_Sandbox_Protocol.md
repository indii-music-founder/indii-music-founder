# Standard Operating Procedure: Firebase Sandbox Isolation

**1. Objective**
Enforce strict isolation of the 260,000 LOC testing environment from the production backend to prevent data contamination, unintended database mutations, and unauthorized API usage during Alpha testing.

**2. Firebase Local Emulator Suite Implementation**
* **Requirement:** All local development and Alpha-level testing MUST strictly route to the Firebase Local Emulator Suite.
* **Configuration:** The application must initialize with emulator routing forced on startup for the `alpha` environment.
* **Services:** Firestore, Authentication, Functions, and Storage must exclusively run locally.

**3. Mock Data Injection**
* **Source:** Read/write operations must utilize locally seeded JSON data strictly from `/02-Firebase_Environments/mock_json_data/`.
* **Prohibition:** Connecting to live production databases or cloning live user data is explicitly forbidden.

**4. API Key Prohibition**
* **Restriction:** Live external API keys (e.g., Stripe, third-party integrations) are strictly prohibited from the Alpha testing environment.
* **Fallback:** Execution must rely on documented test/sandbox keys or utilize local mock responses for external services.
