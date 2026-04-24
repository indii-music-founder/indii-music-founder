# Select-Org Module

The Select-Org module handles multi-organization management and organization selection UI. It enables users managing multiple projects or organizations to seamlessly switch between contexts.

## 🏢 Key Features

- **Organization Switcher:** Quick-access UI for switching between user's organizations/projects.
- **Context Preservation:** Maintains user context when switching organizations.
- **Organization Metadata:** Displays org name, role, and member count.
- **Quick Selection Panel:** Modal or dropdown for fast org switching without navigation.

## 🏗️ Technical Architecture

- **`OrgSelector.tsx`**: Main switcher component with org list and quick actions.
- **Firestore Integration:** Retrieves user's organizations and membership data.
- **Auth Context Integration:** Maintains active organization in app state via Zustand.
- **Role-Based Visibility:** Shows only orgs where user has active membership.

## 🔗 Integrations

- **Auth** module verifies organization membership.
- **Settings** module for organization preferences and management.
- **Dashboard** module adapts display based on selected organization context.
- **Finance** module filters revenue by selected organization.

## 🚀 Future Expansion

- Organization invitations and team management.
- Fine-grained role and permission system.
- Organization templates for rapid team setup.
- Cross-org analytics and consolidated reporting.
