# IMPLICATION: GAP ANALYSIS & FILLING PLAN

## 1. Onboarding & Profile (Priority: High)

- **Status**: **CRITICAL GAP**
- **Issue**: `src/services/storage/repository.ts` has a hardcoded `CURRENT_USER_ID = 'superuser-id'`.
- **Impact**: All profiles are saved to the same ID on the cloud. Real authentication is ignored by the repository layer.
- **Fix**:
  - Update `repository.ts` to accept `userId` as an argument or fetch it from `firebase/auth` directly.
  - Update `ProfileSlice` to pass the correct `uid` to storage methods.

## 2. Music Studio (Priority: Medium)

- **Status**: **GAP DETECTED**
- **Issue**: `MusicStudio` scans files and runs heavy analysis (Essentia WASM) but stores results in local React state. Reloading loses all analysis.
- **Fix**:
  - Create `MusicLibraryService` (Firestore `music_library` collection).
  - Store: `filePath` (or hash), `bpm`, `key`, `energy`, `fingerprint`.
  - checking existing entries before re-analyzing.

## 3. Creative Canvas (Priority: Medium)

- **Status**: **PARTIAL GAP**
- **Issue**: `saveCanvas` only triggers a browser download.
- **Fix**:
  - Add "Save to Project" button in `CreativeCanvas`.
  - Upload PNG to Firebase Storage.
  - Create `Asset` entry in `assets` collection (linked to Project).

## 4. Video Director (Priority: Low)

- **Status**: [CHECKING STORE]
- **Gap**: `VideoDirector` calls `addToHistory`. We are verifying if `addToHistory` in `index.ts` actively persists to Firestore.
- **Plan**: If `addToHistory` is just local state, we need to add persistence there too.

## 5. Audio Analysis

- **Status**: **EPHEMERAL**
- **Fix**: Covered by `MusicLibraryService`.

## Action Plan

1. [x] Check `ProfileSlice`.
2. [x] Check `VideoDirector`.
3. [ ] Check `store/index.ts` for history persistence.
4. [ ] Implement `MusicLibraryService` & Update `MusicStudio`.
5. [ ] Fix `repository.ts` hardcoded ID.
6. [ ] Update `CreativeCanvas` with "Save to Asset".
