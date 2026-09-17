# STRIDE Threat Model: Audio Vault & Cloud Storage

| Threat Category (STRIDE) | Threat Description | Attack Vector | Mitigating Controls |
|---|---|---|---|
| **Spoofing** | Attacker requests audio download using another artist's identity | Forged Firebase auth header | Firebase Storage rules validate `request.auth.uid == resource.metadata.ownerUid`. |
| **Tampering** | Attacker overwrites existing unreleased master track | Direct bucket write attempt | Bucket Object Versioning enabled; write permissions restricted to authenticated creator. |
| **Repudiation** | User claims file was deleted by system | Ambiguous deletion events | GCS lifecycle and deletion audit logs retained in Cloud Logging. |
| **Information Disclosure** | Public access to unreleased master audio files | Misconfigured bucket ACL | Public access prevention enforced (`allUsers` blocked); short-lived signed URLs (<=15 min). |
| **Denial of Service** | Malicious mass upload exhausting storage quotas | Bot uploading gigabytes of junk | Cloud Functions enforce max file size (500MB) and user storage quota limits. |
| **Elevation of Privilege** | Collaborator escalates to master owner | Role manipulation in metadata | Firestore catalog rules strictly distinguish `owner` vs `collaborator` roles. |
