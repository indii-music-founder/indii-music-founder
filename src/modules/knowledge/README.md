# Knowledge Module

## Purpose

The Knowledge Module manages the user's personal knowledge base and assets. It allows users to upload documents, organize information, and make it accessible to the AI agents via RAG (Retrieval Augmented Generation).

## Key Components

### `KnowledgeBase`

The interface for managing documents. Features likely include:

- **File Upload:** Drag-and-drop interface for uploading PDFs, text files, etc.
- **Document List:** View and manage uploaded files.
- **Search:** Search through the knowledge base.

## Integration

- Connects with `FileSearchService` to index and retrieve document content.
- Used by the `Workflow` module for research tasks.
