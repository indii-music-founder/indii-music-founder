# Asset Library & Files Module (RC1)

The Asset Library is the centralized storage and management system for all binary files within indiiOS. It provides a high-performance interface for organizing audio tracks, artwork, and promotional videos across different organizations and projects.

## 📁 Key Features
- **Organization Scoping:** Files are strictly scoped to organizations to ensure multi-tenant security.
- **Smart Categorization:** Automatically groups assets by type (Images, Audio, Video, Documents).
- **Drag-and-Drop:** Intuitive interface for uploading multiple files directly from the desktop.
- **Cloud Sync:** Real-time synchronization with Firebase Storage.
- **Metadata Extraction:** Automatically extracts ISRC, BPM, and bitrate info from audio files upon upload.

## 🏗️ Technical Architecture
- **`FileSystemService`**: Manages the interaction between the UI and the Firestore metadata / Storage binary layers.
- **`fileSystemSlice`**: Zustand state management for tracking the current folder and file selection.
- **IPC Bridge:** In the Electron app, this module interfaces with native file system APIs for high-speed local processing.
- **Zod Schemas:** Strict validation for file names, paths, and metadata structures.

## 🔗 Integrations
- **Creative Studio:** Drag assets directly from the library onto the design canvas.
- **Distribution:** Select mastered audio files for delivery to DSPs.
- **Video Studio:** Import reference images or master videos for synthesis.
