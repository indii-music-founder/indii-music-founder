/**
 * FileSystemService - Native file system access via Web File System Access API
 *
 * Provides secure, privacy-respecting access to local files without uploading to cloud.
 * Perfect for music files where users want to keep their content local.
 *
 * Browser Support: Chrome, Edge, Opera (Safari/Firefox have limited support)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */

// IndexedDB key for persisting directory handles
const IDB_STORE_NAME = 'file-handles';
const IDB_DB_NAME = 'indii-fs';

interface StoredHandle {
  id: string;
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemHandle;
  createdAt: number;
}

class NativeFileSystemService {
  private db: IDBDatabase | null = null;

  /**
   * Check if File System Access API is supported
   */
  isSupported(): boolean {
    return 'showOpenFilePicker' in window && 'showDirectoryPicker' in window;
  }

  /**
   * Initialize IndexedDB for persisting file handles
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Open a file picker for audio files
   * Returns file handle and file data
   */
  async pickAudioFile(): Promise<{ handle: FileSystemFileHandle; file: File } | null> {
    if (!this.isSupported()) {
      console.warn('[FileSystem] File System Access API not supported');
      return null;
    }

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Audio Files',
            accept: {
              'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.aiff'],
            },
          },
        ],
        multiple: false,
      });

      const file = await handle.getFile();
      return { handle, file };
    } catch (err) {
      // User cancelled picker
      if ((err as Error).name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Open a file picker for multiple audio files
   */
  async pickMultipleAudioFiles(): Promise<Array<{ handle: FileSystemFileHandle; file: File }>> {
    if (!this.isSupported()) {
      console.warn('[FileSystem] File System Access API not supported');
      return [];
    }

    try {
      const handles = await window.showOpenFilePicker({
        types: [
          {
            description: 'Audio Files',
            accept: {
              'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.aiff'],
            },
          },
        ],
        multiple: true,
      });

      const results = await Promise.all(
        handles.map(async (handle) => ({
          handle,
          file: await handle.getFile(),
        }))
      );

      return results;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return [];
      }
      throw err;
    }
  }

  /**
   * Open a directory picker - grants access to entire folder
   * Great for music libraries
   */
  async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isSupported()) {
      console.warn('[FileSystem] File System Access API not supported');
      return null;
    }

    try {
      const handle = await window.showDirectoryPicker({
        mode: 'read',
      });
      return handle;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Get all audio files from a directory (recursive)
   */
  async getAudioFilesFromDirectory(
    dirHandle: FileSystemDirectoryHandle,
    recursive = true
  ): Promise<Array<{ path: string; handle: FileSystemFileHandle; file: File }>> {
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.aiff'];
    const results: Array<{ path: string; handle: FileSystemFileHandle; file: File }> = [];

    async function* walkDirectory(
      dir: FileSystemDirectoryHandle,
      path = ''
    ): AsyncGenerator<{ path: string; handle: FileSystemFileHandle }> {
      for await (const entry of (dir as any).values()) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;

        if (entry.kind === 'file') {
          const ext = entry.name.toLowerCase().slice(entry.name.lastIndexOf('.'));
          if (audioExtensions.includes(ext)) {
            yield { path: entryPath, handle: entry as FileSystemFileHandle };
          }
        } else if (entry.kind === 'directory' && recursive) {
          yield* walkDirectory(entry as FileSystemDirectoryHandle, entryPath);
        }
      }
    }

    for await (const { path, handle } of walkDirectory(dirHandle)) {
      const file = await handle.getFile();
      results.push({ path, handle, file });
    }

    return results;
  }

  /**
   * Save a directory handle for persistent access
   * User won't need to re-pick the folder next session
   */
  async saveDirectoryHandle(id: string, handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_NAME);

      const data: StoredHandle = {
        id,
        name: handle.name,
        kind: 'directory',
        handle,
        createdAt: Date.now(),
      };

      const request = store.put(data);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get a saved directory handle
   * Will prompt user for permission if needed
   */
  async getSavedDirectoryHandle(id: string): Promise<FileSystemDirectoryHandle | null> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const data = request.result as StoredHandle | undefined;
        if (!data || data.kind !== 'directory') {
          resolve(null);
          return;
        }

        const handle = data.handle as FileSystemDirectoryHandle;

        // Check if we still have permission
        const permission = await (handle as any).queryPermission({ mode: 'read' });
        if (permission === 'granted') {
          resolve(handle);
          return;
        }

        // Request permission (requires user gesture)
        try {
          const newPermission = await (handle as any).requestPermission({ mode: 'read' });
          if (newPermission === 'granted') {
            resolve(handle);
          } else {
            resolve(null);
          }
        } catch {
          // User denied or API error
          resolve(null);
        }
      };
    });
  }

  /**
   * List all saved handles
   */
  async listSavedHandles(): Promise<Array<{ id: string; name: string; kind: string }>> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const results = (request.result as StoredHandle[]).map((h) => ({
          id: h.id,
          name: h.name,
          kind: h.kind,
        }));
        resolve(results);
      };
    });
  }

  /**
   * Remove a saved handle
   */
  async removeSavedHandle(id: string): Promise<void> {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(IDB_STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Save file to disk (export functionality)
   */
  async saveFile(
    suggestedName: string,
    content: Blob | string,
    types?: any[]
  ): Promise<FileSystemFileHandle | null> {
    if (!this.isSupported()) {
      // Fallback to traditional download
      const blob = typeof content === 'string' ? new Blob([content], { type: 'text/plain' }) : content;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName;
      a.click();
      URL.revokeObjectURL(url);
      return null;
    }

    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: types || [
          {
            description: 'Audio File',
            accept: { 'audio/wav': ['.wav'] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      return handle;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Read file contents as ArrayBuffer (for audio processing)
   */
  async readFileAsArrayBuffer(handle: FileSystemFileHandle): Promise<ArrayBuffer> {
    const file = await handle.getFile();
    return file.arrayBuffer();
  }

  /**
   * Read file contents as text
   */
  async readFileAsText(handle: FileSystemFileHandle): Promise<string> {
    const file = await handle.getFile();
    return file.text();
  }

  /**
   * Get file metadata without reading content
   */
  async getFileMetadata(handle: FileSystemFileHandle): Promise<{
    name: string;
    size: number;
    type: string;
    lastModified: number;
  }> {
    const file = await handle.getFile();
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    };
  }
}

// Export singleton instance
export const nativeFileSystemService = new NativeFileSystemService();
export default nativeFileSystemService;
