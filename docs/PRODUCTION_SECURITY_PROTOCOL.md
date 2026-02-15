# Production Security & Testing Protocols: Protection Against Unauthorized Access and Lateral Movement

**Objective:** To secure the website’s production environment by minimizing human error, protecting critical assets, and preventing attacker lateral movement, balancing security with reliability and velocity.

## 1. Implement "Zero Touch Prod" (ZTP)

**Goal:** Minimize direct human interaction with production systems to reduce unintentional errors and malicious outages.

* **Automation is Mandatory:** All changes to production must be performed through automation or pre-validated software.
* **"Break Glass" Mechanisms:** Emergency access must be strictly audited and used only when automation fails.
* **Restricted Access Controls (NoPe):** Implement "No Persons" (NoPe) controls. If human interaction is strictly necessary, use **safe proxies**—pre-validated tools that only execute approved, safe commands.
* **Privilege Management:**
  * Access beyond automated operations requires clear business justification and approval.
  * Elevated privileges must be **temporary**, never permanent.
* **Testing Requirement:** Automated systems must review and restrict actions based on safety checks and playbooks before execution.

## 2. Secure "Foundational Services" (Crown Jewels)

**Goal:** Apply the highest level of protection to the core services that secure the rest of the infrastructure (e.g., identity management, secrets storage).

* **Identification:** Maintain a small, exclusive list of foundational services. Adding new services to this list should be rare.
* **Maximum Protection:** prioritize security and reliability for these services, even if it results in additional costs or inefficiencies.
* **Data Protection:** **Disable core dumps** on these services to prevent the loss of powerful secrets (such as root access keys) during debugging.
* **Testing Requirement:** These services must undergo regular, rigorous security engineering reviews and frequent audits to reduce their authority wherever possible,.

## 3. Workload Isolation (Security Rings)

**Goal:** Prevent lateral movement by categorizing services based on risk and isolating them accordingly.

* **Hierarchy of Isolation:** Implement **Workload Security Rings (WSR)** to tailor defense measures to the specific needs of the data.
* **Separation of Duties:**
  * **Foundational Workloads:** Must run on dedicated servers and never be scheduled alongside other workload types.
  * **Sensitive Workloads:** Workloads processing customer or product-specific data receive high standards of protection.
  * **Lower Priority Workloads:** Batch processing or experiments can operate with less costly/restrictive measures.
* **Testing Requirement:** Verify that isolation boundaries hold and that a compromise in a low-priority batch process cannot laterally move to a foundational server.

## 4. Risk Governance & Maintenance

**Goal:** Manage the balance between security, reliability, and efficiency.

* **Hard Line on Risk:** Define the level of risk the organization is unwilling to take. Any deviation (suboptimal security posture) requires leadership approval and a concrete plan to restore the optimal state within a set period.
* **Modernization:** Continuously re-architect older, complex systems into smaller functional components to reduce risk.

***

### Analogy for Understanding

To visualize this strategy, imagine your website's infrastructure is a **bio-hazard research facility**:

* **Zero Touch Prod:** Scientists (developers) never touch the dangerous samples directly; they use robotic arms (automation/proxies) from behind a glass wall. This prevents accidental spills (errors) or theft (insider threats).
* **Foundational Services:** The ventilation and power systems are the "crown jewels." If these fail, the containment fails. We protect these at all costs, even if it makes the electricity bill expensive.
* **Workload Security Rings:** The cafeteria is a "low priority ring" with lower security. The virus storage room is a "high priority ring" with dedicated airlocks. You never store lunch in the virus room (dedicated servers).
