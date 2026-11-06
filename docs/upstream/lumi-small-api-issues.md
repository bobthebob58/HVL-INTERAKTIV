# Draft: Lumi issue, small API and typing gaps found while integrating 10.0.4

| | |
|---|---|
| **Recipient** | Lumi's maintainers, repository `Lumieducation/H5P-Nodejs-library` |
| **Channel** | A public GitHub issue, or one issue per item if the maintainers prefer |
| **Status** | Needs the owner's check: whether to file these at all (each is worked around and none is urgent), and whether as one issue or several |
| **Our records** | The `UPSTREAM:` tags in the files named below; D-039, D-043, D-092 (its probe P2 amendment), D-110; D-112 |
| **Checked** | 2026-11-05: 10.0.4 from npm; `master` at 493cd3e (items 1–6 and 8 read there; item 7 from our probe of 2026-10-28 on 10.0.4) |

---

## Title

Small API and typing gaps in `@lumieducation/h5p-server` 10.0.4 (still on `master`)

## Body

We integrate `@lumieducation/h5p-server` 10.0.4 with our own Express 5 routes, Node.js 24 and TypeScript in strict
mode. These eight points needed a cast or a workaround on our side; items 1–6 and 8 are still on `master` at
493cd3e as far as we read, and item 7 we observed on 10.0.4 only. None is a security problem.

1. **Invalid metadata gives a plain `Error`.** `H5PEditor.saveOrUpdateContentReturnMetaData` throws
   `new Error('Metadata does not conform to schema.')` when the metadata fails its schema. *Expected:* an `H5pError`
   with a 4xx status, like the other input errors, so a host can answer 400. *Actual:* a plain `Error`, which a
   host can only tell apart by its message (we compare the message and answer 400:
   `apps/server/src/http/h5pErrorResponse.ts`; test `h5pErrorResponse.test.ts`).
2. **Range callback type.** `H5PAjaxEndpoint.getTemporaryFile`'s `getRangeCallback` is typed to return
   `{ end, start }`, but the code also handles `undefined` (the whole file). *Expected:* the return type includes
   `undefined`. *Actual:* a host that returns `undefined` for "no range" needs a cast
   (`apps/server/src/http/routes/fileRoutes.ts`).
3. **A miss in `IContentUserDataStorage.getContentUserData`.** The interface returns `Promise<IContentUserData>`,
   but `FileContentUserDataStorage` returns `null` for a miss and `ContentUserDataManager` passes it on.
   *Expected:* `Promise<IContentUserData | null>`. *Actual:* an implementation must cast `null`
   (`apps/server/src/h5p/storage/PrismaContentUserDataStorage.ts`).
4. **`SemanticsEnforcer.enforceTextSemantics` is private.** It holds the text rules of the CVE-2025-47828 fix, which
   a host that walks parameters itself wants to reuse. *Request:* export it, or a function that sanitises one text
   field by its semantics (we reach it with a cast: `apps/server/src/h5p/semantics/lumiTextSanitizer.ts`).
5. **`ClamAVScanner` can only be made by `create`.** `create` merges `CLAMSCAN_*` and `CLAMDSCAN_*` environment
   variables over the options it is given and contacts clamd before it returns; the constructor, which takes a
   ready client, is private. *Request:* a public constructor or a factory that takes a configured `clamscan`
   client and reads no environment, so a host decides its scanner's settings alone (we call the constructor with a
   cast: `apps/server/src/security/malware/clamdClient.ts`; tests `createMalwareScanners.test.ts`).
6. **`queryParamGenerator` values are not URL-encoded.** `UrlGenerator.ajaxEndpoint` writes
   `?${qs.name}=${qs.value}&action=` as given. *Expected:* `encodeURIComponent` on both, or documentation that the
   generator must encode them (we build the URL ourselves: `apps/server/src/h5p/HvlUrlGenerator.ts`; test
   `HvlUrlGenerator.test.ts`).
7. **A save with a pasted file reference is not atomic.** When an activity's parameters refer to another activity's
   file (`../<id>/<file>`, H5P's copy and paste), `ContentStorer` copies the file only if the saver may view the
   source; otherwise it empties the path and saves the activity anyway, without an error. A reference whose file
   cannot be copied (for example a name the host's storage refuses) makes the save fail with 400 only after the
   activity was written, which leaves a half-saved draft. *Expected:* a refused copy refuses the save before anything
   is written, with an `H5pError`. (We check the references before Lumi sees the save:
   `apps/server/src/h5p/pasteSourceGuard.ts`; tests `pasteSourceGuard.int.test.ts` and `duplicateFiles.int.test.ts`.)
8. **`ContentFileScanner.urlRegExp` is case-sensitive.** `/^https?:\/\//` without the `i` flag treats
   `Https://example.org/a.png` (a tablet keyboard's capital) as a local file path, while H5P's own `H5P.getPath` tests
   the scheme without regard to case and plays it as a web address. *Expected:* the `i` flag, so both agree
   (`apps/server/src/h5p/pasteSourceGuard.ts`, marked `UPSTREAM:`).
