# Security Specification — روان‌سنج صنعتی (Shared Multi-Computer Firestore)

## 1. Data Invariants
1. **Verified Identity Only**: Every read, list, create, update, or delete operation requires `request.auth != null` and `request.auth.token.email_verified == true`.
2. **Strict Workspace Isolation**: A user can only read, list, create, update, or delete workspaces (and nested `people` / `results`) where `request.auth.uid == resource.data.ownerId` or `request.auth.token.email in resource.data.allowedEmails`.
3. **Master Gate Relational Sync**: Every subcollection operation (`get`, `create`, `update`, `delete`) on `/workspaces/{workspaceId}/people/{personId}` and `/workspaces/{workspaceId}/results/{resultId}` checks the parent `/workspaces/{workspaceId}` document via `get()` to ensure instant revocation if an email is removed from the parent workspace.
4. **No `get()`/`exists()` in `allow list`**: List rules evaluate `resource.data` directly (`ownerId == request.auth.uid` or `request.auth.token.email in resource.data.allowedEmails`) with zero `get()` calls.
5. **Bounded Arrays & Strict String Sizes**: `allowedEmails` is strictly bounded (`1..20` entries, `allowedEmails[0] is string`). Every string field has explicit `.size()` bounds. Every document ID matches `^[a-zA-Z0-9_\-]+$` and `<= 128` chars.
6. **Immutable Ownership & Temporal Integrity**: `ownerId`, `workspaceId`, `createdByUid`, `recordedByUid`, and `createdAt` cannot be modified after creation, and `createdAt`/`updatedAt` must equal `request.time`.
7. **Informed Consent Invariant**: A `Person` record cannot be created unless `consent == true`.
8. **Parent Existence Invariant**: A `TestResult` cannot be created unless its parent `Person` document exists in the same workspace.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `request.auth == null` attempting to read `/workspaces/ws1/people/p1` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoofing**: `request.auth.token.email == 'owner@example.com'` with `email_verified == false` -> `PERMISSION_DENIED`.
3. **Cross-Tenant List Scraping**: Authenticated user `intruder@example.com` calling `list` on `/workspaces/ws1/people` without matching `allowedEmails` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection**: Creating a `Person` with an unexpected ghost key `isAdmin: true` -> `PERMISSION_DENIED` (blocked by `keys().hasOnly(...)`).
5. **Owner Spoofing on Create**: Creating a `Workspace` or `Person` with `ownerId: 'victim_uid'` when `request.auth.uid == 'attacker_uid'` -> `PERMISSION_DENIED`.
6. **ID Poisoning**: Writing to `/workspaces/ws1/people/..%2Fbad$id` or a 200-char ID -> `PERMISSION_DENIED` (blocked by `isValidId()`).
7. **Consent Bypass**: Creating a `Person` with `consent: false` -> `PERMISSION_DENIED`.
8. **Orphaned Result**: Creating a `TestResult` referencing a non-existent `personId` -> `PERMISSION_DENIED` (blocked by `exists(...)`).
9. **Array Exhaustion (Denial of Wallet)**: Creating a `Workspace` with 25 items in `allowedEmails` -> `PERMISSION_DENIED` (blocked by `size() <= 20`).
10. **String Exhaustion**: Creating a `Person` with a 5000-char `name` -> `PERMISSION_DENIED` (blocked by `size() <= 120`).
11. **Timestamp Forgery / Mutation**: Creating a `Person` with `createdAt` set to a past client timestamp, or modifying `createdAt` during `update` -> `PERMISSION_DENIED`.
12. **Member Privilege Escalation**: A non-owner authorized member (`allowedEmails` member) attempting to change `ownerId`, delete the workspace, or remove the owner's email from `allowedEmails` -> `PERMISSION_DENIED`.
