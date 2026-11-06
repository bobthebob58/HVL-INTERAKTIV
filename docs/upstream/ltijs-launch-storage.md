# Draft: ltijs issue, the launch page stops where browser storage is blocked

| | |
|---|---|
| **Recipient** | The ltijs maintainer, repository `Cvmcosta/ltijs` |
| **Channel** | A public GitHub issue |
| **Status** | Needs the owner's check: whether to file it (D-112's Decision names Lumi and H5P only), and whether to add the second point below, which D-050 says an issue should ask for but which we have not measured again on 7.0.7 |
| **Our records** | D-050, D-065, D-112 |
| **Checked** | 2026-11-05: ltijs 7.0.7, still npm's newest |

---

## Title

Launch page: `localStorage.removeItem` outside `try` stops the launch when storage is blocked

## Body

### Environment

- ltijs 7.0.7, `services/launch/templates/signed-state-form.spy`.
- Full Chromium (Playwright 1.56.1, `channel: 'chromium'`) with third-party cookies and storage blocked
  (`--test-third-party-cookie-phaseout`), the tool in an iframe of the platform, as in Canvas.

### Steps to reproduce

1. Launch the tool from the platform in an iframe, in a browser that blocks storage for third-party frames, so that
   reading `window.localStorage` in the frame throws.
2. Let ltijs serve its launch page (the signed-state form).

### Expected

The page falls back to the platform's postMessage storage (as `retrieveState` already does) and submits the form.

### Actual

`retrieveState` guards its `localStorage.getItem` with `try`/`catch` and gets the state through postMessage, but
`submitWith` then calls `localStorage.removeItem(localStorageKey)` with no guard. Where the `localStorage` getter
throws, `submitWith` throws before `document.getElementById('ltijs_launch').submit()`, so the launch never completes.

### Suggested fix

Wrap the `removeItem` call in `try { … } catch (e) {}`, as `getItem` is.

### Our workaround

Our router injects a small script before ltijs's page that guards storage access, so the launch submits
(`apps/server/src/lti/http/ExpressRouterHttpHandler.ts`, marked `UPSTREAM:`). Our tests:
`ExpressRouterHttpHandler.test.ts` ("[LTI-003] sends ltijs HTML with our storage guard first and the LTI headers")
and `ltiPageHeaders.test.ts`; our end-to-end launches run in full Chromium with third-party storage blocked (D-065).

## A second point, if the owner chooses (from D-050, not measured again)

Importing ltijs loads `mongoose`, `mongodb` and `ioredis` even when a host supplies its own database and cache
managers and never connects them. Loading them lazily, inside the managers that use them, would let hosts leave them
out. We ban importing the Mongo and Redis managers in our lint configuration.
