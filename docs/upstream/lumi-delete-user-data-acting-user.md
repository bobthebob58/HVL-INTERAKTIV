# Draft: Lumi issue, `deleteAllContentUserDataByUser` deletes the acting user's state

| | |
|---|---|
| **Recipient** | Lumi's maintainers, repository `Lumieducation/H5P-Nodejs-library` |
| **Channel** | A public GitHub issue. It deletes the wrong person's data, but it gives no one access to anything, so it is a bug, not a vulnerability |
| **Status** | Ready |
| **Our records** | D-108 (the data-subject tool), D-112; PROGRESS S6 step 5 |
| **Checked** | 2026-11-05: 10.0.4 from npm (reproduced) and `master` at 493cd3e (same code, read) |

---

## Title

`ContentUserDataManager.deleteAllContentUserDataByUser` deletes the acting user's state, not the given user's

## Body

### Environment

- `@lumieducation/h5p-server` 10.0.4 (npm); the same code is on `master` at 493cd3e
  (`packages/h5p-server/src/ContentUserDataManager.ts`, lines 39–70).
- Node.js 24.

### Steps to reproduce

1. Create a `ContentUserDataManager` with any `IContentUserDataStorage` and a permission system whose
   `checkForUserData` allows the call.
2. Call `deleteAllContentUserDataByUser('learner-1', operator)`, where `operator` is an `IUser` with the ID
   `operator-1`.
3. See which user the storage is asked to delete.

A minimal script (a recording stand-in for the storage), saved as `repro.mjs` in a folder where
`@lumieducation/h5p-server` 10.0.4 is installed and run with `node repro.mjs` (an ES module, for the top-level
`await`):

```js
import { ContentUserDataManager } from '@lumieducation/h5p-server';
const calls = [];
const storage = new Proxy({}, { get: (_t, name) => async (...args) => { calls.push([name, ...args]); } });
const manager = new ContentUserDataManager(storage, { checkForUserData: async () => true });
await manager.deleteAllContentUserDataByUser('learner-1', { id: 'operator-1', type: 'local' });
console.log(JSON.stringify(calls));
```

### Expected

The permission check is made for `forUserId` (`'learner-1'`), so the storage should be asked to delete
`learner-1`'s state.

### Actual

```text
[["deleteAllContentUserDataByUser",{"id":"operator-1","type":"local"}]]
```

The manager checks the permission for `forUserId`, then passes `actingUser` to
`contentUserDataStorage.deleteAllContentUserDataByUser`. An administrator who deletes a learner's saved state
(for example to answer a data-protection request) deletes their own state instead, and the learner's stays, with no
error.

### Suggested fix

Pass the user to delete to the storage. `IContentUserDataStorage.deleteAllContentUserDataByUser` takes an `IUser`,
while the manager receives a user ID, so either the manager takes an `IUser` for the user to delete, or the storage
method takes a user ID. A test with two users, where one deletes the other's state, would cover it.

### Our workaround

Our data-subject tool calls our own storage's `deleteAllContentUserDataByUser` directly, with the learner's user
object, and never calls the manager's method (`apps/server/src/privacy/dsr/subjectErasure.ts`, marked
`UPSTREAM:`). Our test `dataSubjectErasure.int.test.ts` ("[DATA-008] a confirmed erasure deletes the rest of her
rows in both years, through our storage, and her identities" and "[DATA-008] the other learner, the year without a
secret and the operator’s own account stay") checks that the learner's state is deleted through our storage, never
through the manager, and that the other learner's rows and the operator's own account stay.
