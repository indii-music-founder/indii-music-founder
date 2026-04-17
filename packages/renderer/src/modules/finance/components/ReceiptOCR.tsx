// 1. Upload the file using resumable upload
const fileMeta = await firebaseAI.fileService.uploadFile(uploadedFile);

// 2. Wait for it to be active
await firebaseAI.fileService.waitForActive(fileMeta.name);

// 3. Analyze the URI
const responseText = await firebaseAI.analyzeFileURI(
    fileMeta.uri,
    fileMeta.mimeType,
    jsonPrompt
);