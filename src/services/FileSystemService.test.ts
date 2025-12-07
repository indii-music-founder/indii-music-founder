import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileSystemService } from './FileSystemService';

// Mock IndexedDB
const mockIDBStore: Record<string, unknown> = {};
const mockIDBRequest = (result: unknown) => ({
  result,
  error: null,
  onsuccess: null as (() => void) | null,
  onerror: null as (() => void) | null,
});

const mockIDBTransaction = {
  objectStore: vi.fn(() => ({
    put: vi.fn((data) => {
      const req = mockIDBRequest(undefined);
      mockIDBStore[data.id] = data;
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    get: vi.fn((id) => {
      const req = mockIDBRequest(mockIDBStore[id]);
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    getAll: vi.fn(() => {
      const req = mockIDBRequest(Object.values(mockIDBStore));
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
    delete: vi.fn((id) => {
      const req = mockIDBRequest(undefined);
      delete mockIDBStore[id];
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    }),
  })),
};

const mockIDBDatabase = {
  transaction: vi.fn(() => mockIDBTransaction),
  objectStoreNames: { contains: vi.fn(() => true) },
  createObjectStore: vi.fn(),
};

// Mock File System Access API types
interface MockFileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  queryPermission: ReturnType<typeof vi.fn>;
  requestPermission: ReturnType<typeof vi.fn>;
}

interface MockFileSystemFileHandle extends MockFileSystemHandle {
  kind: 'file';
  getFile: ReturnType<typeof vi.fn>;
}

interface MockFileSystemDirectoryHandle extends MockFileSystemHandle {
  kind: 'directory';
  values: ReturnType<typeof vi.fn>;
}

describe('FileSystemService', () => {
  let originalIndexedDB: IDBFactory;
  let originalShowOpenFilePicker: typeof window.showOpenFilePicker;
  let originalShowDirectoryPicker: typeof window.showDirectoryPicker;
  let originalShowSaveFilePicker: typeof window.showSaveFilePicker;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockIDBStore).forEach(key => delete mockIDBStore[key]);

    // Store originals
    originalIndexedDB = globalThis.indexedDB;
    originalShowOpenFilePicker = (globalThis as typeof window).showOpenFilePicker;
    originalShowDirectoryPicker = (globalThis as typeof window).showDirectoryPicker;
    originalShowSaveFilePicker = (globalThis as typeof window).showSaveFilePicker;

    // Mock IndexedDB
    const mockOpen = vi.fn(() => {
      const req = mockIDBRequest(mockIDBDatabase);
      setTimeout(() => {
        (req as { onupgradeneeded?: (e: { target: { result: typeof mockIDBDatabase } }) => void }).onupgradeneeded?.({ target: { result: mockIDBDatabase } });
        req.onsuccess?.();
      }, 0);
      return req;
    });

    globalThis.indexedDB = { open: mockOpen } as unknown as IDBFactory;
  });

  afterEach(() => {
    // Restore originals
    globalThis.indexedDB = originalIndexedDB;
    if (originalShowOpenFilePicker) {
      (globalThis as typeof window).showOpenFilePicker = originalShowOpenFilePicker;
    }
    if (originalShowDirectoryPicker) {
      (globalThis as typeof window).showDirectoryPicker = originalShowDirectoryPicker;
    }
    if (originalShowSaveFilePicker) {
      (globalThis as typeof window).showSaveFilePicker = originalShowSaveFilePicker;
    }
  });

  describe('isSupported', () => {
    it('returns true when File System Access API is available', () => {
      (globalThis as typeof window).showOpenFilePicker = vi.fn();
      (globalThis as typeof window).showDirectoryPicker = vi.fn();

      expect(fileSystemService.isSupported()).toBe(true);
    });

    it('returns false when File System Access API is not available', () => {
      delete (globalThis as Partial<typeof window>).showOpenFilePicker;
      delete (globalThis as Partial<typeof window>).showDirectoryPicker;

      expect(fileSystemService.isSupported()).toBe(false);
    });
  });

  describe('pickAudioFile', () => {
    it('returns null when API is not supported', async () => {
      delete (globalThis as Partial<typeof window>).showOpenFilePicker;
      delete (globalThis as Partial<typeof window>).showDirectoryPicker;

      const result = await fileSystemService.pickAudioFile();
      expect(result).toBeNull();
    });

    it('returns file handle and file on success', async () => {
      const mockFile = new File(['audio data'], 'song.mp3', { type: 'audio/mpeg' });
      const mockHandle: MockFileSystemFileHandle = {
        kind: 'file',
        name: 'song.mp3',
        getFile: vi.fn().mockResolvedValue(mockFile),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      (globalThis as typeof window).showOpenFilePicker = vi.fn().mockResolvedValue([mockHandle]);
      (globalThis as typeof window).showDirectoryPicker = vi.fn();

      const result = await fileSystemService.pickAudioFile();

      expect(result).not.toBeNull();
      expect(result?.file.name).toBe('song.mp3');
      expect(result?.handle).toBe(mockHandle);
    });

    it('returns null when user cancels picker', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';

      (globalThis as typeof window).showOpenFilePicker = vi.fn().mockRejectedValue(abortError);
      (globalThis as typeof window).showDirectoryPicker = vi.fn();

      const result = await fileSystemService.pickAudioFile();
      expect(result).toBeNull();
    });

    it('throws on non-abort errors', async () => {
      const otherError = new Error('Permission denied');

      (globalThis as typeof window).showOpenFilePicker = vi.fn().mockRejectedValue(otherError);
      (globalThis as typeof window).showDirectoryPicker = vi.fn();

      await expect(fileSystemService.pickAudioFile()).rejects.toThrow('Permission denied');
    });
  });

  describe('pickMultipleAudioFiles', () => {
    it('returns empty array when API is not supported', async () => {
      delete (globalThis as Partial<typeof window>).showOpenFilePicker;
      delete (globalThis as Partial<typeof window>).showDirectoryPicker;

      const result = await fileSystemService.pickMultipleAudioFiles();
      expect(result).toEqual([]);
    });

    it('returns multiple files on success', async () => {
      const mockFile1 = new File(['audio1'], 'song1.mp3', { type: 'audio/mpeg' });
      const mockFile2 = new File(['audio2'], 'song2.wav', { type: 'audio/wav' });

      const mockHandle1: MockFileSystemFileHandle = {
        kind: 'file',
        name: 'song1.mp3',
        getFile: vi.fn().mockResolvedValue(mockFile1),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };
      const mockHandle2: MockFileSystemFileHandle = {
        kind: 'file',
        name: 'song2.wav',
        getFile: vi.fn().mockResolvedValue(mockFile2),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      (globalThis as typeof window).showOpenFilePicker = vi.fn().mockResolvedValue([mockHandle1, mockHandle2]);
      (globalThis as typeof window).showDirectoryPicker = vi.fn();

      const result = await fileSystemService.pickMultipleAudioFiles();

      expect(result).toHaveLength(2);
      expect(result[0].file.name).toBe('song1.mp3');
      expect(result[1].file.name).toBe('song2.wav');
    });
  });

  describe('pickDirectory', () => {
    it('returns null when API is not supported', async () => {
      delete (globalThis as Partial<typeof window>).showOpenFilePicker;
      delete (globalThis as Partial<typeof window>).showDirectoryPicker;

      const result = await fileSystemService.pickDirectory();
      expect(result).toBeNull();
    });

    it('returns directory handle on success', async () => {
      const mockDirHandle: MockFileSystemDirectoryHandle = {
        kind: 'directory',
        name: 'Music',
        values: vi.fn(),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      (globalThis as typeof window).showOpenFilePicker = vi.fn();
      (globalThis as typeof window).showDirectoryPicker = vi.fn().mockResolvedValue(mockDirHandle);

      const result = await fileSystemService.pickDirectory();

      expect(result).toBe(mockDirHandle);
    });

    it('returns null when user cancels', async () => {
      const abortError = new Error('User cancelled');
      abortError.name = 'AbortError';

      (globalThis as typeof window).showOpenFilePicker = vi.fn();
      (globalThis as typeof window).showDirectoryPicker = vi.fn().mockRejectedValue(abortError);

      const result = await fileSystemService.pickDirectory();
      expect(result).toBeNull();
    });
  });

  describe('getAudioFilesFromDirectory', () => {
    it('finds audio files recursively', async () => {
      const mockAudioFile = new File(['audio'], 'track.mp3', { type: 'audio/mpeg' });
      const mockTextFile = new File(['text'], 'readme.txt', { type: 'text/plain' });

      const mockFileHandle: MockFileSystemFileHandle = {
        kind: 'file',
        name: 'track.mp3',
        getFile: vi.fn().mockResolvedValue(mockAudioFile),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      const mockTextHandle: MockFileSystemFileHandle = {
        kind: 'file',
        name: 'readme.txt',
        getFile: vi.fn().mockResolvedValue(mockTextFile),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      const mockSubDirHandle: MockFileSystemDirectoryHandle = {
        kind: 'directory',
        name: 'subfolder',
        values: vi.fn().mockReturnValue({
          async *[Symbol.asyncIterator]() {
            yield mockFileHandle;
          }
        }[Symbol.asyncIterator]()),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      const mockDirHandle = {
        kind: 'directory' as const,
        name: 'Music',
        values: vi.fn().mockReturnValue({
          async *[Symbol.asyncIterator]() {
            yield mockTextHandle;
            yield mockSubDirHandle;
          }
        }[Symbol.asyncIterator]()),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      const result = await fileSystemService.getAudioFilesFromDirectory(
        mockDirHandle as unknown as FileSystemDirectoryHandle
      );

      expect(result).toHaveLength(1);
      expect(result[0].file.name).toBe('track.mp3');
      expect(result[0].path).toBe('subfolder/track.mp3');
    });

    it('filters by audio extensions', async () => {
      const extensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.aiff'];

      for (const ext of extensions) {
        const mockFile = new File(['audio'], `track${ext}`, { type: 'audio/mpeg' });
        const mockHandle: MockFileSystemFileHandle = {
          kind: 'file',
          name: `track${ext}`,
          getFile: vi.fn().mockResolvedValue(mockFile),
          queryPermission: vi.fn(),
          requestPermission: vi.fn(),
        };

        const mockDirHandle = {
          kind: 'directory' as const,
          name: 'Music',
          values: vi.fn().mockReturnValue({
            async *[Symbol.asyncIterator]() {
              yield mockHandle;
            }
          }[Symbol.asyncIterator]()),
          queryPermission: vi.fn(),
          requestPermission: vi.fn(),
        };

        const result = await fileSystemService.getAudioFilesFromDirectory(
          mockDirHandle as unknown as FileSystemDirectoryHandle
        );

        expect(result).toHaveLength(1);
        expect(result[0].file.name).toBe(`track${ext}`);
      }
    });
  });

  describe('saveFile', () => {
    it('falls back to download when API not supported', async () => {
      delete (globalThis as Partial<typeof window>).showOpenFilePicker;
      delete (globalThis as Partial<typeof window>).showDirectoryPicker;

      // Mock URL and document for fallback
      const mockUrl = 'blob:test';
      const mockCreateObjectURL = vi.fn().mockReturnValue(mockUrl);
      const mockRevokeObjectURL = vi.fn();
      const mockClick = vi.fn();
      const mockCreateElement = vi.fn().mockReturnValue({
        href: '',
        download: '',
        click: mockClick,
      });

      globalThis.URL.createObjectURL = mockCreateObjectURL;
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL;
      globalThis.document.createElement = mockCreateElement;

      const result = await fileSystemService.saveFile('output.wav', new Blob(['audio']));

      expect(result).toBeNull();
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });

    it('uses native save picker when supported', async () => {
      const mockWritable = {
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const mockHandle = {
        createWritable: vi.fn().mockResolvedValue(mockWritable),
      };

      (globalThis as typeof window).showOpenFilePicker = vi.fn();
      (globalThis as typeof window).showDirectoryPicker = vi.fn();
      (globalThis as typeof window).showSaveFilePicker = vi.fn().mockResolvedValue(mockHandle);

      const content = new Blob(['audio data']);
      const result = await fileSystemService.saveFile('output.wav', content);

      expect(result).toBe(mockHandle);
      expect(mockHandle.createWritable).toHaveBeenCalled();
      expect(mockWritable.write).toHaveBeenCalledWith(content);
      expect(mockWritable.close).toHaveBeenCalled();
    });
  });

  describe('readFileAsArrayBuffer', () => {
    it('reads file contents as ArrayBuffer', async () => {
      const audioData = new Uint8Array([1, 2, 3, 4]);
      const mockArrayBuffer = audioData.buffer;
      const mockFile = {
        name: 'song.mp3',
        type: 'audio/mpeg',
        size: 4,
        lastModified: Date.now(),
        arrayBuffer: vi.fn().mockResolvedValue(mockArrayBuffer),
        text: vi.fn(),
      };
      const mockHandle: MockFileSystemFileHandle = {
        kind: 'file',
        name: 'song.mp3',
        getFile: vi.fn().mockResolvedValue(mockFile),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      const result = await fileSystemService.readFileAsArrayBuffer(
        mockHandle as unknown as FileSystemFileHandle
      );

      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(result)).toEqual(audioData);
    });
  });

  describe('readFileAsText', () => {
    it('reads file contents as text', async () => {
      const textContent = 'Hello World';
      const mockFile = {
        name: 'readme.txt',
        type: 'text/plain',
        size: textContent.length,
        lastModified: Date.now(),
        arrayBuffer: vi.fn(),
        text: vi.fn().mockResolvedValue(textContent),
      };
      const mockHandle: MockFileSystemFileHandle = {
        kind: 'file',
        name: 'readme.txt',
        getFile: vi.fn().mockResolvedValue(mockFile),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      const result = await fileSystemService.readFileAsText(
        mockHandle as unknown as FileSystemFileHandle
      );

      expect(result).toBe(textContent);
    });
  });

  describe('getFileMetadata', () => {
    it('returns file metadata without reading content', async () => {
      const mockFile = new File(['audio data here'], 'song.mp3', { type: 'audio/mpeg' });
      Object.defineProperty(mockFile, 'lastModified', { value: 1700000000000 });

      const mockHandle: MockFileSystemFileHandle = {
        kind: 'file',
        name: 'song.mp3',
        getFile: vi.fn().mockResolvedValue(mockFile),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };

      const result = await fileSystemService.getFileMetadata(
        mockHandle as unknown as FileSystemFileHandle
      );

      expect(result.name).toBe('song.mp3');
      expect(result.size).toBe(15); // 'audio data here'.length
      expect(result.type).toBe('audio/mpeg');
      expect(result.lastModified).toBe(1700000000000);
    });
  });

  describe('IndexedDB persistence', () => {
    it('saves and retrieves directory handles', async () => {
      const mockDirHandle = {
        kind: 'directory' as const,
        name: 'MyMusic',
        queryPermission: vi.fn().mockResolvedValue('granted'),
        requestPermission: vi.fn().mockResolvedValue('granted'),
      };

      // Save the handle
      await fileSystemService.saveDirectoryHandle('lib-1', mockDirHandle as unknown as FileSystemDirectoryHandle);

      // List saved handles
      const handles = await fileSystemService.listSavedHandles();
      expect(handles).toContainEqual({ id: 'lib-1', name: 'MyMusic', kind: 'directory' });

      // Retrieve the handle
      const retrieved = await fileSystemService.getSavedDirectoryHandle('lib-1');
      expect(retrieved).not.toBeNull();

      // Remove the handle
      await fileSystemService.removeSavedHandle('lib-1');
      const handlesAfterRemove = await fileSystemService.listSavedHandles();
      expect(handlesAfterRemove).not.toContainEqual({ id: 'lib-1', name: 'MyMusic', kind: 'directory' });
    });

    it('returns null for non-existent handle', async () => {
      const result = await fileSystemService.getSavedDirectoryHandle('non-existent');
      expect(result).toBeNull();
    });
  });
});

describe('FileSystemService Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles empty directory gracefully', async () => {
    const mockDirHandle = {
      kind: 'directory' as const,
      name: 'EmptyFolder',
      values: vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          // No entries
        }
      }[Symbol.asyncIterator]()),
      queryPermission: vi.fn(),
      requestPermission: vi.fn(),
    };

    const result = await fileSystemService.getAudioFilesFromDirectory(
      mockDirHandle as unknown as FileSystemDirectoryHandle
    );

    expect(result).toEqual([]);
  });

  it('handles deeply nested directories', async () => {
    const mockFile = new File(['audio'], 'deep.mp3', { type: 'audio/mpeg' });

    const createNestedDir = (depth: number, fileName: string): MockFileSystemDirectoryHandle => {
      if (depth === 0) {
        const fileHandle: MockFileSystemFileHandle = {
          kind: 'file',
          name: fileName,
          getFile: vi.fn().mockResolvedValue(mockFile),
          queryPermission: vi.fn(),
          requestPermission: vi.fn(),
        };
        return {
          kind: 'directory',
          name: `level${depth}`,
          values: vi.fn().mockReturnValue({
            async *[Symbol.asyncIterator]() {
              yield fileHandle;
            }
          }[Symbol.asyncIterator]()),
          queryPermission: vi.fn(),
          requestPermission: vi.fn(),
        };
      }
      return {
        kind: 'directory',
        name: `level${depth}`,
        values: vi.fn().mockReturnValue({
          async *[Symbol.asyncIterator]() {
            yield createNestedDir(depth - 1, fileName);
          }
        }[Symbol.asyncIterator]()),
        queryPermission: vi.fn(),
        requestPermission: vi.fn(),
      };
    };

    const mockDirHandle = createNestedDir(3, 'deep.mp3');

    const result = await fileSystemService.getAudioFilesFromDirectory(
      mockDirHandle as unknown as FileSystemDirectoryHandle
    );

    expect(result).toHaveLength(1);
    expect(result[0].path).toContain('level');
  });

  it('handles mixed file types correctly', async () => {
    const createMockFile = (name: string, type: string) =>
      new File(['data'], name, { type });

    const files = [
      { name: 'song.mp3', type: 'audio/mpeg', shouldInclude: true },
      { name: 'image.png', type: 'image/png', shouldInclude: false },
      { name: 'video.mp4', type: 'video/mp4', shouldInclude: false },
      { name: 'track.flac', type: 'audio/flac', shouldInclude: true },
      { name: 'doc.pdf', type: 'application/pdf', shouldInclude: false },
      { name: 'music.wav', type: 'audio/wav', shouldInclude: true },
    ];

    const mockHandles = files.map(f => ({
      kind: 'file' as const,
      name: f.name,
      getFile: vi.fn().mockResolvedValue(createMockFile(f.name, f.type)),
      queryPermission: vi.fn(),
      requestPermission: vi.fn(),
    }));

    const mockDirHandle = {
      kind: 'directory' as const,
      name: 'Mixed',
      values: vi.fn().mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const h of mockHandles) {
            yield h;
          }
        }
      }[Symbol.asyncIterator]()),
      queryPermission: vi.fn(),
      requestPermission: vi.fn(),
    };

    const result = await fileSystemService.getAudioFilesFromDirectory(
      mockDirHandle as unknown as FileSystemDirectoryHandle
    );

    expect(result).toHaveLength(3); // Only audio files
    expect(result.map(r => r.file.name)).toContain('song.mp3');
    expect(result.map(r => r.file.name)).toContain('track.flac');
    expect(result.map(r => r.file.name)).toContain('music.wav');
    expect(result.map(r => r.file.name)).not.toContain('image.png');
  });
});
