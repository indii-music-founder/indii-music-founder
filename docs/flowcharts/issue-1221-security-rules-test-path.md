# ISSUE-1221 Security Rules Test Path

This flow shows how the Firebase package security-rules tests locate their rules files independently of the directory from which Vitest is launched.

```mermaid
flowchart TD
    TestRun["Vitest launched from packages/firebase"] --> TestFile["storage.rules.test.ts"]
    TestFile --> DirPath["Resolve from test-file __dirname"]
    DirPath --> StorageRules["packages/firebase/storage.rules"]
    DirPath --> FirestoreRules["packages/firebase/firestore.rules"]
    StorageRules --> Emulator["Firestore and Storage emulators"]
    FirestoreRules --> Emulator
    Emulator --> Assertions["Security-rule assertions execute"]

    style TestRun fill:#e0f7fa,stroke:#00acc1,stroke-width:2px
    style TestFile fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style DirPath fill:#f3e5f5,stroke:#8e24aa,stroke-width:2px
    style StorageRules fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style FirestoreRules fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style Emulator fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Assertions fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

## Step-by-Step Transition Breakdown

1. Vitest runs with `packages/firebase` as its working directory.
2. The test resolves both rules files from its own stable directory, `packages/firebase/src/test/security`, rather than the caller-controlled working directory.
3. `../../../storage.rules` and `../../../firestore.rules` reach the package-level rules files without duplicating `packages/firebase`.
4. The Firebase test environment loads those rules into the local emulators.
5. The focused suites execute their real security assertions instead of failing during file loading with `ENOENT`.
