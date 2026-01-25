# Implementation Plan - Video Pipeline Hardening

## Objective

Implement robust video upload handling using Firebase Storage Resumable Uploads and ensure correct metadata handling to align with Firebase Video Best Practices.

## Proposed Changes

### 1. New Service: `VideoUploadService.ts`

- **Location**: `src/services/video/VideoUploadService.ts`
- **Features**:
  - `uploadVideo(file, path, metadata)`: Wraps `uploadBytesResumable`.
  - Enforces `Content-Type: video/mp4` (or detection).
  - Sets `Cache-Control: public, max-age=3600`.
  - Progress tracking support.
  - Error handling for network interruptions.

### 2. Integration

- Ensure `StorageService` can delegate large video uploads to this service or user it directly.

## Verification

- **Test**: `src/services/video/VideoUploadService.test.ts` to mock Firebase Storage and verify metadata setting.
