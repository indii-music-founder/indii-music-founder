# Knowledge Base Module (RC1)

The Knowledge Base is the long-term memory of the artist's ecosystem. It stores critical information about their brand, audience, past projects, and creative preferences, ensuring the AI system grows smarter over time.

## 🧠 Key Features
- **Semantic Search:** Find information across documents, chat history, and metadata using natural language queries.
- **Brand Wiki:** A structured repository for official brand descriptions, aesthetic rules, and style guides.
- **RAG (Retrieval Augmented Generation):** Injects relevant context from the knowledge base into AI agent prompts to prevent hallucinations.
- **Asset Library:** A unified view of all files, images, and audio stored within the active organization.

## 🏗️ Technical Architecture
- **`GeminiRetrievalService`**: Handles the embedding and retrieval of semantic data.
- **Vector Search**: High-performance lookup of relevant context snippets.
- **Firestore Integration**: Persistent storage of structured knowledge items.
- **Context Injection**: Automatic enrichment of agent calls with relevant project history.
