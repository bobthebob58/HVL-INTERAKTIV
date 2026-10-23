# apps/web

## Purpose

The web pages of HVL Interaktiv, built with Next.js (App Router) and React. They are the application around the
H5P pages: header, help, privacy, tabs, notices, the findings list and the publish dialog. The H5P player and
editor themselves stay server-rendered by Express under their own strict policy (D-067); these pages frame them on
the same origin.

The app has **no server endpoints of its own**: no route handlers, server actions, middleware or API routes
(`test/appStructure.test.ts` enforces it). Every data request goes from the browser to the Express API, which checks
the session cookie and CSRF token or the Bearer ltik. Express runs this app inside its own process and removes
cookies, tokens and the `ltik` query before a request reaches Next.js (D-068).

**Status (Session 4, in progress).** The in-process mount, the nonce policy, the locale header, the translations
and `/hjelp` exist; the page shell, components and the other pages arrive later in Session 4.

## How to run

The app is never started on its own; the server serves it.

```bash
npm run build                         # builds apps/web (NEXT_TELEMETRY_DISABLED=1 next build) into apps/web/.next
WEB_APP=prod npm start                # the server, with the built app
WEB_APP=dev npm start                 # the server, with Next.js's development server (hot reload)
npm run typecheck --workspace apps/web   # next typegen, then tsc
npx vitest run --project web          # translations and the structure test
npx vitest run apps/server/test/web   # the mount: header contract, nonce policy, the built app in Chromium
```

The browser test of the built app is skipped locally when `apps/web/.next` is missing and fails in CI, which builds
first.

## Folder structure

| Path | What it holds |
|---|---|
| `src/app/layout.tsx` | The document: `<html lang>` from the request's locale, the site title |
| `src/app/hjelp/page.tsx` | `/hjelp` |
| `src/app/not-found.tsx` | The translated 404 page for paths nothing else answers |
| `src/app/globals.css` | Base typography until the design tokens arrive (no colours) |
| `src/i18n/translate.ts`, `locales/{nn,nb,en}.json` | Typed `t()`; Nynorsk is the reference and the default (D-076) |
| `src/i18n/requestLocale.ts` | Reads Express's `x-hvli-locale` header |
| `next.config.mjs` | No image optimiser, no `X-Powered-By`, the monorepo root for tracing |
| `test/` | Unit tests of the app's own logic and the structure test |

`next-env.d.ts` and `.next/` are generated (`next build`, `next dev`, `next typegen`) and not committed.

## Key flows

```mermaid
sequenceDiagram
    participant B as Browser
    participant E as Express (apps/server)
    participant N as Next.js (this app, same process)
    B->>E: GET /hjelp (session cookie)
    E->>E: no Express route matched; GET or HEAD only
    E->>E: nonce policy; locale from the portal session (else nn)
    E->>N: request without cookie, authorization, ltik, x-hvli-* from the client; with CSP and x-hvli-locale
    N-->>B: HTML: every script carries the nonce; response CSP from Express
    B->>E: GET /_next/static/... (scripts, styles)
    E->>N: same hand-over
```

## Configuration

The app reads no environment variables. The server's `WEB_APP` (`off`, `dev`, `prod`) decides whether it runs;
see `apps/server/.env.example`. Next.js telemetry is always off (`NEXT_TELEMETRY_DISABLED`, set by the build script
and by the server before Next.js loads).

## Implements

| Requirement | Where | Tests |
|---|---|---|
| `DATA-011` First-party pages under a strict policy | `apps/server/src/web/webPageCsp.ts`, `webRoutes.ts`, `next.config.mjs` | `apps/server/test/web/webPageCsp.test.ts`, `webRoutes.int.test.ts`, `webApp.browser.int.test.ts` |
| `UD-010` Page language | `src/app/layout.tsx`, `src/i18n/requestLocale.ts` | `test/i18n/translate.test.ts`, `apps/server/test/web/webApp.browser.int.test.ts` |
| `PROD-012` Nynorsk first, nb and en | `src/i18n/` | `test/i18n/translate.test.ts` |
| `AUTH-003`, `LTI-003` No credentials or endpoints in the web app | `apps/server/src/web/webRequestContract.ts` | `apps/server/test/web/webRequestContract.test.ts`, `test/appStructure.test.ts` |
