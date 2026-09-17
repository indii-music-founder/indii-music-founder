# Information Security Policy (POL-001)

## 1. Overview and Purpose
indii.music ("the Company") is committed to protecting the confidentiality, integrity, and availability of our systems, infrastructure, customer data, and artist intellectual property (including unreleased music recordings, stems, metadata, and financial earnings). This Information Security Policy defines the overarching governance framework, management commitment, and baseline security requirements.

## 2. Scope
This policy applies to:
- All information systems, cloud infrastructure (Google Cloud Platform, Firebase), repositories (GitHub), networks, and client applications (Web and Electron desktop).
- All employees, contractors, advisors, and third-party personnel who design, develop, operate, or maintain indii.music services.
- All confidential and customer data processed or stored by indii.music.

## 3. Guiding Principles
1. **Security by Design**: Security controls, threat modeling, and boundary validation are integrated directly into early software architecture and engineering workflows.
2. **Least Privilege**: Access to production environments, administrative consoles, and sensitive user data is restricted to the minimum permissions required.
3. **Data Segregation & Tenant Isolation**: Multitenant data models strictly enforce tenant isolation at both the database rule layer (Firestore rules) and application logic layer.
4. **Continuous Verification**: Controls are monitored continuously through automated CI/CD pipelines, automated dependency scans, and real-time cloud alerting.

## 4. Roles and Responsibilities
- **Chief Information Security Officer (CISO) / Founder**: Accountable for overall security strategy, resource allocation, and annual policy reviews.
- **Lead Engineers**: Responsible for implementing technical controls, enforcing code review standards, maintaining audit logging, and executing vulnerability remediation.
- **All Team Members**: Obligated to adhere to security policies, report anomalies promptly, protect authentication credentials, and complete annual security training.

## 5. Policy Review & Maintenance
This policy and all subordinate compliance policies are reviewed and updated at least annually, or immediately following any significant architectural or organizational change.

*Approved by Leadership: 2026-09-17*
