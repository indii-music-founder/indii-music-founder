# History Module

The History module serves as the central directory of past interactions, agents' threads, and system orchestrations.

## 🕒 Key Features

- **Global Context Viewer:** Access past conversations and specific agent instructions across all domains.
- **`HistoryDashboard` UI:** Dedicated dashboard for searching and resuming old threads.
- **State Restoration:** Integrated with the core app state to "replay" or "re-enter" specific historical contexts without losing ongoing tasks.

## 🏗️ Technical Architecture

- Primarily powered by `ConversationHistoryList`, hooked into the global `Zustand` store.
- Re-hydrates past configurations and tasks dynamically.

## 🔗 Integrations

- Relies heavily on **Agent Zero** and the **Dashboard** for cross-module context switching.
- Persistent histories backed by **Firestore** documents under the user's root scope.
