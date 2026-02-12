# Database Platinum Protocol (V1.0)

The **Database Platinum Protocol** extends [PLATINUM_POLISH.md](../PLATINUM_POLISH.md) with rigorous standards specific to the Firestore database layer. It ensures data integrity, security, and performance across all database operations.

---

## The 7 Pillars of Database Platinum

### 1. Schema Enforcement (The "Single Source of Truth" Rule)

> [!IMPORTANT]
> Every collection MUST have a corresponding TypeScript interface and Firestore security rule with schema validation.

- **Rule**: All data shapes are defined in TypeScript interfaces, in a centralized location.
- **Action**:
  - Define interfaces in `src/types/firestore.ts`.
  - Mirror validation in `firestore.rules` using `isValid*` helper functions.
  - Never write to Firestore without type-checking the payload first.

**Pattern:**

```typescript
// ✅ CORRECT - Typed service with explicit interface
interface Campaign {
  id: string;
  userId: string;
  name: string;
  status: "draft" | "active" | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const campaignService = new FirestoreService<Campaign>("campaigns");
```

```javascript
// ✅ CORRECT - Matching validation in firestore.rules
function isValidCampaign(data) {
  return (
    data.keys().hasAll(["userId", "name", "status", "createdAt"]) &&
    data.status in ["draft", "active", "archived"]
  );
}
```

---

### 2. ID Hygiene (The "Predictable Keys" Rule)

- **Rule**: Document IDs must be predictable, collision-resistant, and human-debuggable.
- **Action**:
  - Use `uuidv4()` or `nanoid()` for user-generated content.
  - Use `userId_timestamp` composite keys for user-scoped singletons (e.g., daily usage docs).
  - **NEVER** use Firestore `addDoc()` auto-IDs for documents that need external reference (e.g., ISRCs, UPCs).

**Pattern:**

```typescript
// ✅ CORRECT - Predictable composite ID for singleton
const usageDocId = `${userId}_${formatDate(new Date(), "yyyy-MM-dd")}`;
await firestoreService.set(usageDocId, usageData);

// ✅ CORRECT - External reference uses explicit ID
const isrcId = `US-ABC-00-12345`;
await isrcService.set(isrcId, {
  userId,
  trackTitle,
  registeredAt: Timestamp.now(),
});

// ❌ VIOLATION - Auto-generated ID for externally-referenced document
const docRef = await addDoc(collection(db, "isrc_registry"), data);
```

---

### 3. Ownership Anchoring (The "No Orphaned Data" Rule)

> [!CAUTION]
> Every document MUST have an ownership anchor (`userId` or `orgId`). Documents without ownership are untraceable and unprotectable.

- **Rule**: All documents must be scoped to a user or organization.
- **Action**:
  - Always include `userId` or `orgId` field during creation.
  - Validate ownership in `firestore.rules` before any read/write.
  - Audit existing collections for orphaned documents quarterly.

**Pattern:**

```typescript
// ✅ CORRECT - Ownership anchor included
async createCampaign(name: string): Promise<string> {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new AppException(AppErrorCode.UNAUTHORIZED, 'User not authenticated');

  return campaignService.add({
    userId, // ANCHOR
    name,
    status: 'draft',
  });
}
```

---

### 4. Timestamp Discipline (The "Audit Trail" Rule)

- **Rule**: All mutable documents must have `createdAt` and `updatedAt` timestamps managed automatically.
- **Action**:
  - Use `FirestoreService.add()` and `.update()` which auto-inject timestamps.
  - Never allow clients to override `createdAt`.
  - Use `Timestamp.now()` (server time), never `new Date()` (client time).

**Pattern:**

```typescript
// FirestoreService already handles this:
async add(data: Omit<T, 'id'>): Promise<string> {
  const docRef = await addDoc(this.collection, {
    ...data,
    createdAt: Timestamp.now(), // ✅ Automatic
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}
```

---

### 5. Security Rule Parity (The "Rules Are Law" Rule)

> [!WARNING]
> If the TypeScript service allows an operation, the security rule MUST also allow it. If the rule denies it, the service must never attempt it.

- **Rule**: Security rules and service logic must be in sync.
- **Action**:
  - When adding a new collection, update `firestore.rules` FIRST.
  - Test security rules with `npm run test:rules` before deploying.
  - Document any rule changes in the PR description.

**Verification Command:**

```bash
# Run the security rules test suite
npm run test -- firestore.rules.test.ts && npm run test -- firestore.rules.test.ts && npm run test -- firestore.rules.test.ts
```

---

### 6. Query Efficiency (The "No Full Scans" Rule)

- **Rule**: Every query must use an index or be bounded by a user/org scope.
- **Action**:
  - Always filter by `userId` or `orgId` first.
  - Create composite indexes in `firestore.indexes.json` for complex queries.
  - Limit result sets with `.limit()` for pagination.
  - Avoid `in` queries with more than 30 elements (Firestore limit).

**Pattern:**

```typescript
// ✅ CORRECT - Scoped and limited
const campaigns = await campaignService.list([
  where("userId", "==", currentUserId),
  where("status", "==", "active"),
  orderBy("createdAt", "desc"),
  limit(20),
]);

// ❌ VIOLATION - Full collection scan
const allDocs = await getDocs(collection(db, "campaigns"));
```

---

### 7. Offline Resilience (The "Graceful Degradation" Rule)

- **Rule**: The app must function gracefully when offline or when Firestore is unavailable.
- **Action**:
  - Use real-time listeners (`onSnapshot`) with error callbacks for critical UI.
  - Implement optimistic UI updates for writes.
  - Never block the UI on a Firestore read; show cached/placeholder state.
  - Log offline events but don't expose raw errors to users.

**Pattern:**

```typescript
// ✅ CORRECT - Real-time listener with error handling
firestoreService.subscribe(
  [where("userId", "==", userId)],
  (data) => setCampaigns(data), // Success
  (error) => {
    console.warn("[CampaignService] Offline or error:", error.message);
    showToast({
      type: "warning",
      message: "Working offline. Changes will sync when connected.",
    });
  },
);
```

---

## Rollout Checklist

When adding a new Firestore collection:

- [ ] **1. Define Interface**: Add TypeScript interface to `src/types/firestore.ts`.
- [ ] **2. Add Security Rule**: Update `firestore.rules` with read/write/validate logic.
- [ ] **3. Create Typed Service**: Instantiate `FirestoreService<YourInterface>('collection_name')`.
- [ ] **4. Add Indexes**: If using compound queries, add to `firestore.indexes.json`.
- [ ] **5. Write Tests**: Add unit tests for the service AND a security rule test case.
- [ ] **6. Document**: Add JSDoc to public service methods.

---

## Audit Commands

```bash
# Scan for untyped Firestore operations
grep -r "collection(db," src --include="*.ts" --include="*.tsx" | grep -v "FirestoreService"

# Scan for missing userId/orgId in writes
grep -r "addDoc\|setDoc" src --include="*.ts" | grep -v "userId\|orgId"

# Verify security rules
npm run test -- firestore.rules.test.ts

# Deploy rules to production (REQUIRES REVIEW)
firebase deploy --only firestore:rules
```

---

## Compliance Matrix

| Pillar               | Platinum Standard               | Audit Metric               |
| -------------------- | ------------------------------- | -------------------------- |
| Schema Enforcement   | 100% typed services             | `grep "FirestoreService<"` |
| ID Hygiene           | 0 auto-IDs for external refs    | Manual audit               |
| Ownership Anchoring  | 100% docs have userId/orgId     | Security rules validation  |
| Timestamp Discipline | Auto-managed timestamps         | `grep "createdAt"`         |
| Security Rule Parity | Rules test pass rate = 100%     | `npm run test:rules`       |
| Query Efficiency     | 0 full collection scans         | Query analysis             |
| Offline Resilience   | Error handlers on all listeners | Code review                |

---

**Protocol Version:** 1.0  
**Last Updated:** 2026-01-17  
**Next Review:** 2026-02-17
