import { vi } from 'vitest';

// Only import DOM-specific modules when running in jsdom environment
if (typeof window !== 'undefined') {
    // @ts-expect-error - testing-library/jest-dom types not found in this environment
    await import('@testing-library/jest-dom');
    // @ts-expect-error - fake-indexeddb types not found in this environment
    await import('fake-indexeddb/auto');

    // Mock ResizeObserver
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    };

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
        })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => []),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
    });

    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mock');

    // Mock getComputedStyle (jsdom limitation)
    if (!window.getComputedStyle || window.getComputedStyle.toString().includes('Not implemented')) {
        window.getComputedStyle = vi.fn().mockImplementation(() => ({
            getPropertyValue: vi.fn().mockReturnValue(''),
            removeProperty: vi.fn(),
            setProperty: vi.fn(),
            length: 0,
            item: vi.fn().mockReturnValue(''),
        }));
    }

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

// ============================================================================
// FIREBASE MOCKS - Centralized for all test files
// ============================================================================

// Mock the @/services/firebase module FIRST to prevent module-level initialization
// This is critical because firebase.ts has side effects that call real Firebase APIs at import time
vi.mock('@/services/firebase', () => ({
    app: { name: 'mock-app', options: {} },
    db: {},
    storage: {},
    auth: {
        currentUser: { uid: 'test-uid', email: 'test@test.com' },
        onAuthStateChanged: vi.fn((callback) => {
            // Simulate immediate callback with authenticated user
            if (typeof callback === 'function') {
                setTimeout(() => callback({ uid: 'test-uid', email: 'test@test.com' }), 0);
            }
            return () => { }; // Return unsubscribe function
        }),
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn()
    },
    functions: {},
    functionsWest1: {},
    remoteConfig: { defaultConfig: {} },
    messaging: null,
    appCheck: null,
    ai: { instance: null },
    getFirebaseAI: vi.fn(() => null)
}));

// Mock Firebase App
vi.mock('firebase/app', () => ({
    initializeApp: vi.fn(() => ({
        name: 'mock-app',
        options: {},
        delete: vi.fn()
    }))
}));

// Mock Firebase Auth
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({
        currentUser: { uid: 'test-uid', email: 'test@test.com' },
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChanged: vi.fn(() => () => { })
    })),
    initializeAuth: vi.fn(() => ({
        currentUser: { uid: 'test-uid', email: 'test@test.com' },
        signInWithEmailAndPassword: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChanged: vi.fn(() => () => { })
    })),
    browserLocalPersistence: {},
    browserSessionPersistence: {},
    indexedDBLocalPersistence: {},
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn()
}));

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
    const Timestamp = {
        now: vi.fn(() => ({ toMillis: () => Date.now(), toDate: () => new Date(), seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
        fromDate: vi.fn((date: Date) => ({ toMillis: () => date.getTime(), toDate: () => date, seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
        fromMillis: vi.fn((millis: number) => ({ toMillis: () => millis, toDate: () => new Date(millis), seconds: Math.floor(millis / 1000), nanoseconds: 0 }))
    };

    return {
        initializeFirestore: vi.fn(() => ({})),
        getFirestore: vi.fn(() => ({})),
        Timestamp,
        collection: vi.fn(() => ({ id: 'mock-coll-id' })),
        doc: vi.fn(() => ({ id: crypto.randomUUID() })),
        addDoc: vi.fn(() => Promise.resolve({ id: 'mock-doc-id' })),
        getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}), id: 'mock-doc-id' })),
        getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0, forEach: vi.fn() })),
        setDoc: vi.fn(() => Promise.resolve()),
        updateDoc: vi.fn(() => Promise.resolve()),
        deleteDoc: vi.fn(() => Promise.resolve()),
        onSnapshot: vi.fn(() => () => { }),
        onSnapshots: vi.fn(() => () => { }),
        query: vi.fn(() => ({})),
        where: vi.fn(() => ({})),
        limit: vi.fn(() => ({})),
        orderBy: vi.fn(() => ({})),
        startAfter: vi.fn(() => ({})),
        arrayUnion: vi.fn((...args) => args),
        arrayRemove: vi.fn((...args) => args),
        increment: vi.fn((n) => n),
        serverTimestamp: vi.fn(() => new Date()),
        getDocsViaCache: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0, forEach: vi.fn() })),
        getDocViaCache: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}), id: 'mock-doc-id' })),
        disableNetwork: vi.fn(() => Promise.resolve()),
        enableNetwork: vi.fn(() => Promise.resolve()),
        persistentLocalCache: vi.fn(() => ({})),
        persistentMultipleTabManager: vi.fn(() => ({})),
        runTransaction: vi.fn((cb) => cb({
            get: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}), id: 'mock-doc-id' })),
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        })),
        writeBatch: vi.fn(() => ({
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            commit: vi.fn(() => Promise.resolve())
        })),

    };
});

// Mock Firebase Functions
vi.mock('firebase/functions', () => ({
    getFunctions: vi.fn(() => ({})),
    httpsCallable: vi.fn(() => vi.fn().mockResolvedValue({ data: {} }))
}));

// Mock Firebase Storage
vi.mock('firebase/storage', () => ({
    getStorage: vi.fn(() => ({})),
    ref: vi.fn(),
    uploadBytes: vi.fn(),
    getDownloadURL: vi.fn(() => Promise.resolve('https://mock-url.com'))
}));

// Mock Firebase Remote Config
vi.mock('firebase/remote-config', () => ({
    fetchAndActivate: vi.fn(() => Promise.resolve(true)),
    getValue: vi.fn((rc, key) => ({
        asString: () => key === 'model_name' ? 'mock-model-v1' : 'us-central1',
        asBoolean: () => false,
        asNumber: () => 1
    })),
    getRemoteConfig: vi.fn(() => ({})),
    initializeRemoteConfig: vi.fn(() => ({}))
}));

// Mock Firebase Messaging
vi.mock('firebase/messaging', () => ({
    getMessaging: vi.fn(() => ({})),
    getToken: vi.fn(() => Promise.resolve('mock-fcm-token')),
    onMessage: vi.fn(() => () => { })
}));

// Mock Firebase App Check
vi.mock('firebase/app-check', () => ({
    initializeAppCheck: vi.fn(() => ({})),
    getToken: vi.fn(() => Promise.resolve({ token: 'mock-app-check-token' }))
}));
// Mock Firebase AI
vi.mock('firebase/ai', () => ({
    SchemaType: {
        STRING: 'STRING',
        NUMBER: 'NUMBER',
        BOOLEAN: 'BOOLEAN',
        OBJECT: 'OBJECT',
        ARRAY: 'ARRAY'
    },
    getAI: vi.fn(() => ({})),
    getGenerativeModel: vi.fn(() => ({
        generateContent: vi.fn().mockResolvedValue({
            response: {
                text: () => "{}",
                functionCalls: () => []
            }
        }),
        generateContentStream: vi.fn().mockResolvedValue({
            stream: {
                [Symbol.asyncIterator]: async function* () {
                    yield { text: () => "{}" };
                }
            },
            response: Promise.resolve({
                text: () => "{}",
                functionCalls: () => []
            })
        }),
        startChat: vi.fn(() => ({
            sendMessage: vi.fn().mockResolvedValue({
                response: {
                    text: () => "{}",
                    functionCalls: () => []
                }
            })
        }))
    })),
    getLiveGenerativeModel: vi.fn(() => ({})),
    VertexAIBackend: vi.fn().mockImplementation(function () {
        return {};
    })
}));

// Mock AgentZeroService to prevent 60s interaction timeouts in tests
vi.mock('@/services/agent/AgentZeroService', () => ({
    AgentZeroService: vi.fn(),
    agentZeroService: {
        sendMessage: vi.fn().mockResolvedValue({ message: 'Mock Agent Zero Response' }),
        executeTask: vi.fn().mockResolvedValue({ status: 'success', data: { response: 'Mock Task Response' } }),
        provisionProject: vi.fn().mockResolvedValue({ status: 'success' }),
        syncProject: vi.fn().mockResolvedValue({ status: 'success' }),
        getHistory: vi.fn().mockResolvedValue([])
    }
}));

// Mock lucide-react with simple stub factory
vi.mock('lucide-react', async () => {
    const React = await import('react');

    const createMockIcon = (name: string) => {
        const MockIcon = (props: Record<string, unknown>) => {
            return React.createElement('svg', {
                'data-testid': `icon-${name}`,
                ...props
            });
        };
        MockIcon.displayName = name;
        return MockIcon;
    };

    // Pre-define commonly used icons to avoid dynamic property access issues
    return {
        __esModule: true,
        // UI Layout
        Menu: createMockIcon('Menu'),
        X: createMockIcon('X'),
        Maximize2: createMockIcon('Maximize2'),
        PanelTopClose: createMockIcon('PanelTopClose'),
        PanelTopOpen: createMockIcon('PanelTopOpen'),
        MonitorPlay: createMockIcon('MonitorPlay'),
        Database: createMockIcon('Database'),

        // Navigation
        ChevronDown: createMockIcon('ChevronDown'),
        ChevronUp: createMockIcon('ChevronUp'),
        ChevronLeft: createMockIcon('ChevronLeft'),
        ChevronRight: createMockIcon('ChevronRight'),
        ArrowLeft: createMockIcon('ArrowLeft'),
        ArrowLeftToLine: createMockIcon('ArrowLeftToLine'),
        ArrowRight: createMockIcon('ArrowRight'),
        ArrowRightToLine: createMockIcon('ArrowRightToLine'),
        Home: createMockIcon('Home'),
        Settings: createMockIcon('Settings'),
        // Actions
        Plus: createMockIcon('Plus'),
        Minus: createMockIcon('Minus'),
        Edit: createMockIcon('Edit'),
        Trash: createMockIcon('Trash'),
        Trash2: createMockIcon('Trash2'),
        Save: createMockIcon('Save'),
        Copy: createMockIcon('Copy'),
        Check: createMockIcon('Check'),
        Search: createMockIcon('Search'),
        Filter: createMockIcon('Filter'),
        Download: createMockIcon('Download'),
        Share: createMockIcon('Share'),
        Share2: createMockIcon('Share2'),
        Upload: createMockIcon('Upload'),
        Send: createMockIcon('Send'),
        Play: createMockIcon('Play'),
        Pause: createMockIcon('Pause'),
        Stop: createMockIcon('Stop'),
        // Media
        Image: createMockIcon('Image'),
        Video: createMockIcon('Video'),
        Music: createMockIcon('Music'),
        Mic: createMockIcon('Mic'),
        Camera: createMockIcon('Camera'),
        // Status
        AlertCircle: createMockIcon('AlertCircle'),
        AlertTriangle: createMockIcon('AlertTriangle'),
        Info: createMockIcon('Info'),
        HelpCircle: createMockIcon('HelpCircle'),
        Loader: createMockIcon('Loader'),
        Loader2: createMockIcon('Loader2'),
        // Communication
        MessageCircle: createMockIcon('MessageCircle'),
        MessageSquare: createMockIcon('MessageSquare'),
        Mail: createMockIcon('Mail'),
        Bell: createMockIcon('Bell'),
        // Files & Folders
        File: createMockIcon('File'),
        FileText: createMockIcon('FileText'),
        Folder: createMockIcon('Folder'),
        FolderOpen: createMockIcon('FolderOpen'),
        // Users
        User: createMockIcon('User'),
        Users: createMockIcon('Users'),
        UserPlus: createMockIcon('UserPlus'),
        // Other common
        Star: createMockIcon('Star'),
        Heart: createMockIcon('Heart'),
        Link: createMockIcon('Link'),
        ExternalLink: createMockIcon('ExternalLink'),
        Eye: createMockIcon('Eye'),
        EyeOff: createMockIcon('EyeOff'),
        Lock: createMockIcon('Lock'),
        Unlock: createMockIcon('Unlock'),
        Key: createMockIcon('Key'),
        Globe: createMockIcon('Globe'),
        Calendar: createMockIcon('Calendar'),
        Clock: createMockIcon('Clock'),
        Tag: createMockIcon('Tag'),
        Hash: createMockIcon('Hash'),
        MoreHorizontal: createMockIcon('MoreHorizontal'),
        MoreVertical: createMockIcon('MoreVertical'),
        Sparkles: createMockIcon('Sparkles'),
        Wand2: createMockIcon('Wand2'),
        Zap: createMockIcon('Zap'),
        RefreshCw: createMockIcon('RefreshCw'),
        RotateCcw: createMockIcon('RotateCcw'),
        Maximize: createMockIcon('Maximize'),
        Minimize: createMockIcon('Minimize'),
        Grid: createMockIcon('Grid'),
        List: createMockIcon('List'),
        Layers: createMockIcon('Layers'),
        Layout: createMockIcon('Layout'),
        Palette: createMockIcon('Palette'),
        Paintbrush: createMockIcon('Paintbrush'),
        Pen: createMockIcon('Pen'),
        Type: createMockIcon('Type'),
        Bold: createMockIcon('Bold'),
        Italic: createMockIcon('Italic'),
        Underline: createMockIcon('Underline'),
        AlignLeft: createMockIcon('AlignLeft'),
        AlignCenter: createMockIcon('AlignCenter'),
        AlignRight: createMockIcon('AlignRight'),
        BarChart: createMockIcon('BarChart'),
        PieChart: createMockIcon('PieChart'),
        TrendingUp: createMockIcon('TrendingUp'),
        TrendingDown: createMockIcon('TrendingDown'),
        DollarSign: createMockIcon('DollarSign'),
        CreditCard: createMockIcon('CreditCard'),
        Package: createMockIcon('Package'),
        Truck: createMockIcon('Truck'),
        MapPin: createMockIcon('MapPin'),
        Navigation: createMockIcon('Navigation'),
        Compass: createMockIcon('Compass'),
        Target: createMockIcon('Target'),
        Award: createMockIcon('Award'),
        Gift: createMockIcon('Gift'),
        Bookmark: createMockIcon('Bookmark'),
        Flag: createMockIcon('Flag'),
        ThumbsUp: createMockIcon('ThumbsUp'),
        ThumbsDown: createMockIcon('ThumbsDown'),
        Volume: createMockIcon('Volume'),
        Volume2: createMockIcon('Volume2'),
        VolumeX: createMockIcon('VolumeX'),
        Radio: createMockIcon('Radio'),
        Headphones: createMockIcon('Headphones'),
        Monitor: createMockIcon('Monitor'),
        Smartphone: createMockIcon('Smartphone'),
        Tablet: createMockIcon('Tablet'),
        Laptop: createMockIcon('Laptop'),
        Server: createMockIcon('Server'),
        Cloud: createMockIcon('Cloud'),
        CloudUpload: createMockIcon('CloudUpload'),
        CloudDownload: createMockIcon('CloudDownload'),
        Wifi: createMockIcon('Wifi'),
        WifiOff: createMockIcon('WifiOff'),
        Bluetooth: createMockIcon('Bluetooth'),
        Power: createMockIcon('Power'),
        Battery: createMockIcon('Battery'),
        Cpu: createMockIcon('Cpu'),
        HardDrive: createMockIcon('HardDrive'),
        Terminal: createMockIcon('Terminal'),
        Code: createMockIcon('Code'),
        GitBranch: createMockIcon('GitBranch'),
        GitCommit: createMockIcon('GitCommit'),
        GitMerge: createMockIcon('GitMerge'),
        Github: createMockIcon('Github'),
        Gitlab: createMockIcon('Gitlab'),
        Twitter: createMockIcon('Twitter'),
        Facebook: createMockIcon('Facebook'),
        Instagram: createMockIcon('Instagram'),
        Youtube: createMockIcon('Youtube'),
        Linkedin: createMockIcon('Linkedin'),
        Slack: createMockIcon('Slack'),
        Discord: createMockIcon('Discord'),
        Feather: createMockIcon('Feather'),
        Sun: createMockIcon('Sun'),
        Moon: createMockIcon('Moon'),
        Sunrise: createMockIcon('Sunrise'),
        Sunset: createMockIcon('Sunset'),
        Thermometer: createMockIcon('Thermometer'),
        Droplet: createMockIcon('Droplet'),
        Wind: createMockIcon('Wind'),
        Umbrella: createMockIcon('Umbrella'),
        CloudRain: createMockIcon('CloudRain'),
        Snowflake: createMockIcon('Snowflake'),
        Flame: createMockIcon('Flame'),
        Anchor: createMockIcon('Anchor'),
        Aperture: createMockIcon('Aperture'),
        Activity: createMockIcon('Activity'),
        Airplay: createMockIcon('Airplay'),
        AlertOctagon: createMockIcon('AlertOctagon'),
        Archive: createMockIcon('Archive'),
        AtSign: createMockIcon('AtSign'),
        Box: createMockIcon('Box'),
        Briefcase: createMockIcon('Briefcase'),
        Cast: createMockIcon('Cast'),
        CheckCircle: createMockIcon('CheckCircle'),
        CheckSquare: createMockIcon('CheckSquare'),
        Circle: createMockIcon('Circle'),
        Clipboard: createMockIcon('Clipboard'),
        Command: createMockIcon('Command'),
        Crosshair: createMockIcon('Crosshair'),
        Disc: createMockIcon('Disc'),
        Divide: createMockIcon('Divide'),
        DoorOpen: createMockIcon('DoorOpen'),
        DoorClosed: createMockIcon('DoorClosed'),
        Eraser: createMockIcon('Eraser'),
        Expand: createMockIcon('Expand'),
        FastForward: createMockIcon('FastForward'),
        Rewind: createMockIcon('Rewind'),
        Frown: createMockIcon('Frown'),
        Smile: createMockIcon('Smile'),
        Meh: createMockIcon('Meh'),
        Inbox: createMockIcon('Inbox'),
        Layers2: createMockIcon('Layers2'),
        Lightbulb: createMockIcon('Lightbulb'),
        LogIn: createMockIcon('LogIn'),
        LogOut: createMockIcon('LogOut'),
        Move: createMockIcon('Move'),
        Paperclip: createMockIcon('Paperclip'),
        Percent: createMockIcon('Percent'),
        Phone: createMockIcon('Phone'),
        PhoneCall: createMockIcon('PhoneCall'),
        Printer: createMockIcon('Printer'),
        QrCode: createMockIcon('QrCode'),
        Rocket: createMockIcon('Rocket'),
        Save2: createMockIcon('Save2'),
        Scissors: createMockIcon('Scissors'),
        Shield: createMockIcon('Shield'),
        ShieldCheck: createMockIcon('ShieldCheck'),
        ShoppingCart: createMockIcon('ShoppingCart'),
        Shuffle: createMockIcon('Shuffle'),
        SlidersHorizontal: createMockIcon('SlidersHorizontal'),
        Square: createMockIcon('Square'),
        Tv: createMockIcon('Tv'),
        Voicemail: createMockIcon('Voicemail'),
        Watch: createMockIcon('Watch'),
        XCircle: createMockIcon('XCircle'),
        XSquare: createMockIcon('XSquare'),
        ZoomIn: createMockIcon('ZoomIn'),
        ZoomOut: createMockIcon('ZoomOut'),
    };
});

