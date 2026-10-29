# apps/web

## Purpose

The web pages of HVL Interaktiv, built with Next.js (App Router), React and Tailwind CSS v4 on HVL's design tokens.
They are the application around the H5P pages: the start page with the person's activities, the activity page with
the tabs **Spel**, **Rediger** and **Sjekk og publiser**, the new-activity page, the Canvas page `/app/play`, help and
the privacy notice, and from S5 the læringsdesign studio: the public guide and pattern pages, and the planner, the
content bank and the pedagogisk mappe for authors (D-089). The H5P player and editor themselves stay server-rendered
by Express under their own strict policy (D-067); these pages frame them on the same origin.

The app has **no server endpoints of its own**: no route handlers, server actions, middleware or API routes
(`test/appStructure.test.ts` enforces it). Every data request goes from the browser to the Express API, which checks
the session cookie and CSRF token or the Bearer ltik. Express runs this app inside its own process and removes
cookies, tokens and the `ltik` query before a request reaches Next.js (D-068), so server components render only the
shell and the locale; client components fetch the data.

**Status (Session 4).** Shell, components and pages are in place. HVL's logo files are not yet supplied (Q2): the
header shows the site name as text until `src/config/branding.ts` names them. HVL's data protection officer must
review the privacy notice (Q6).

**Status (Session 5).** The studio is in place: the public guide with the phase matrix and the pattern catalogue, the
pattern pages with «Lag frå dette mønsteret», the planner, the content bank and `/mappe` with its two downloads, and
the activity page's **Læringsdesign** and **Deling** tabs and the editor's save choice (D-089). The studio's texts
come from the server's `content/` and are drafts until ALU confirms them (Q17), and so are three texts of this app
in `src/i18n/locales/`: the bank's consent text, the privacy page's sentences about colleagues and the guide page's
working title (`docs/reference/alu-review-s5.md`). The Canvas side of the studio is S6 (D-098). The
activity page's tabs come from a registry (`src/features/activity/tabs/activityTabs.ts`), so a new tab is one file
and one line.

## How to run

The app is never started on its own; the server serves it.

```bash
npm run build                         # builds apps/web (NEXT_TELEMETRY_DISABLED=1 next build) into apps/web/.next
WEB_APP=prod npm start                # the server, with the built app
WEB_APP=dev npm start                 # the server, with Next.js's development server (hot reload)
npm run typecheck --workspace apps/web   # next typegen, then tsc
npx vitest run --project web          # components (jsdom), API calls, translations, structure
npx vitest run apps/server/test/web   # the mount and every page of the built app in Chromium
npm run lint:css                      # Stylelint: no colour literals, rem font sizes, no capitals or justify
```

The browser tests of the built app are skipped locally when `apps/web/.next` is missing and fail in CI, which builds
first.

## Folder structure

| Path | What it holds |
|---|---|
| `src/app/layout.tsx` | The document: `<html lang>` from the request's locale, the title template ("<page> – HVL Interaktiv"), the skip link, the locale for client components |
| `src/app/(portal)/` | The portal pages in the portal chrome: `/`, `/aktivitet/[id]`, `/aktivitet/ny`, `/hjelp`, `/personvern`; the studio's `/laeringsdesign`, `/laeringsdesign/monster/[patternId]`, `/laeringsdesign/planlegg`, `/laeringsdesign/innhaldsbank` and `/mappe`; `not-found.tsx` for a portal page that calls `notFound()` |
| `src/app/app/play/page.tsx` | `/app/play`, the Canvas page: reads Express's `x-hvli-launch` header |
| `src/app/not-found.tsx` | The translated 404 page in the portal chrome |
| `src/app/globals.css`, `src/styles/components.css` | Tailwind v4 with the token theme; base rules, focus ring, reduced motion; skip link, header, buttons |
| `src/components/` | One component per file: ExternalLink, FileLink, ErrorSummary, Tabs, Dialog, Notice, FindingsList, PublishDialog (its texts and reason rules in `publishReasons.ts`), AcknowledgementField, LearnerInfo (time and purpose before an activity), H5pFrame, StatusBadge, LoginPrompt, AuthorGate (signed-out, refused or author content), TextSections, SiteHeader, StudioNav (the header's main menu), SiteFooter, PortalChrome, NotFoundContent |
| `src/features/` | The pages' client views: `portal/` (start page), `activity/` (activity and new-activity pages; `activity/tabs/` holds one file per tab and the registry `activityTabs.ts`), `lti/` (Canvas page), `info/` (help and privacy sections), `studio/` (the guide page: `GuideView`, the node renderers in `guide/`, `PhaseMatrix`, the catalogue and its address-held filters in `catalogue/`; the pattern page: `PatternDetailView` and «Lag frå dette mønsteret» in `pattern/`), `learningDesign/` (the **Læringsdesign** tab's form, its fields and the publish dialog's prompt), `planner/` (`PlannerView`, the course chooser, the table, the gaps and the untagged list), `sharing/` (the **Deling** tab: visibility, co-authors with the people search, the bank listing with its consent text, «Lag ein kopi»), `bank/` (the content bank's entries), `mappe/` (`MappeView`, `MappeWorkspace` with the filters, the activity picker, the criteria set and language, the word count and the downloads) |
| `src/api/` | Browser calls of the Express API with the right credential (`apiRequest.ts`: JSON answers, `DELETE`, and file answers for downloads with `apiFileRequest`), the portal session, typed by `@hvl-interaktiv/api-contract` |
| `src/messaging/` | Messages with the framed H5P pages: `hvli:content-saved`, `hvli:go-to-field`, the editor's save choice (`hvli:modal-open`/`hvli:modal-closed` make the page inert around the frame, `hvli:content-copied` opens the copy's Rediger tab, PROD-013), H5P's resize protocol |
| `src/config/` | Every address the app links to or frames (`paths.ts`, with the studio's query `?fase=&type=&tid=&emne=` and the activity page's `?fane=`); reading the studio's query back (`studioFilters.ts`); the logo slot (`branding.ts`) |
| `src/i18n/` | Typed `t()`, `locales/{nn,nb,en}.json` (Nynorsk is the reference, D-076), the request locale, page titles, the `lang` of an activity's title, dates, type names |
| `src/lti/launchHeader.ts` | Parses the launch Express resolved for `/app/play`, strictly: unknown keys or values out of bounds are no launch; the minutes and the purpose learners see (PED-032) |
| `next.config.mjs`, `postcss.config.mjs` | No image optimiser, no `X-Powered-By`, the contract package compiled; Tailwind through PostCSS |
| `test/` | Component tests (jsdom), unit tests, the structure test; `test/support/` has the fake `fetch` and cleanup |

`next-env.d.ts` and `.next/` are generated (`next build`, `next dev`, `next typegen`) and not committed.

## Key flows

A portal page: Express hands over the request without credentials; the browser then asks the API itself.

```mermaid
sequenceDiagram
    participant B as Browser
    participant E as Express (apps/server)
    participant N as Next.js (this app, same process)
    B->>E: GET /aktivitet/<id> (session cookie)
    E->>N: request without cookie, authorization, ltik; with nonce CSP and x-hvli-locale
    N-->>B: the shell: header with Hjelp, main#main, footer with Personvern; scripts with the nonce
    B->>E: GET /auth/session (cookie)
    E-->>B: { roles, locale, csrfToken } or 401 (then the Feide login link)
    B->>E: GET /api/content/<id> (cookie)
    E-->>B: { title, status, mayEdit, mayPublish }
    B->>E: GET /h5p/play/<id> in a titled iframe; /h5p/edit/<id> on the Rediger tab
    Note over B: the editor posts hvli:content-saved; the page fetches the findings again
    B->>E: POST /api/content/<id>/publish (cookie, X-CSRF-Token, { updatedAt, acknowledgements })
    E-->>B: published, or 409 publish-blocked / content-changed, shown in plain language
```

The Canvas page: Express resolves the ltik before Next.js runs; the page keeps the ltik in memory only.

```mermaid
sequenceDiagram
    participant C as Canvas iframe
    participant E as Express
    participant N as Next.js
    C->>E: GET /app/play?ltik=… (after the LTI launch)
    E->>E: resolve the ltik, check View, decide mayEdit, then read the learner info (PED-032, D-087)
    E->>N: request without the ltik; x-hvli-launch = encoded { contentId, title, mayEdit, locale, language?, estimatedStudentMinutes?, learnerPurpose? }
    N-->>C: the Canvas chrome; Hjelp and Personvern open in a new tab
    C->>C: read the ltik from the address bar once, history.replaceState without it (and once more for Next.js's router)
    C->>E: GET /lti/play?ltik=… (Spel) and, for authors, /lti/edit?ltik=… (Rediger)
    C->>E: GET /api/me, PUT /api/me/notices/formative-use (Authorization: Bearer <ltik>, no cookie)
```

The page language (`x-hvli-locale`) is the launch's, else the `?lang=` of a help or privacy link (`nn`, `nb`, `en`),
else the portal session's, else Nynorsk. The header's **Hjelp** and the footer's **Personvern** carry the page's
locale, because inside Canvas they open in a new tab that has no launch (DATA-006).

## Configuration

The app reads no environment variables. The server's `WEB_APP` (`off`, `dev`, `prod`) decides whether it runs;
see `apps/server/.env.example`. Next.js telemetry is always off (`NEXT_TELEMETRY_DISABLED`, set by the build script
and by the server before Next.js loads). The logo files are configured in `src/config/branding.ts`.

## Implements

| Requirement | Where | Tests |
|---|---|---|
| `UD-001`, `UD-002` Token colours and typography | `src/app/globals.css`, `src/styles/components.css`, `postcss.config.mjs` | `npm run lint:css`, `apps/server/test/web/webPages.browser.int.test.ts` |
| `UD-003` Status and severity not by colour alone | `src/components/StatusBadge.tsx`, `FindingsList.tsx` | `test/components/StatusBadge.test.tsx`, `FindingsList.test.tsx` |
| `UD-004` Two-tone focus, sticky header with scroll padding | `src/app/globals.css`, `src/styles/components.css` | `apps/server/test/web/webPages.browser.int.test.ts` |
| `UD-006` Skip link, tabs, modal dialog | `src/app/layout.tsx`, `src/components/Tabs.tsx`, `Dialog.tsx` | `test/components/Tabs.test.tsx`, `Dialog.test.tsx`, `SiteHeader.test.tsx` |
| `UD-007` Honest links | `src/components/ExternalLink.tsx`, `FileLink.tsx` | `test/components/ExternalLink.test.tsx`, `FileLink.test.tsx` |
| `UD-008` Reflow at 320 px | every page; `src/messaging/useH5pResizer.ts` | `apps/server/test/web/webPages.browser.int.test.ts`, `test/messaging/useH5pResizer.test.tsx` |
| `UD-009`, `UD-012` Reduced motion, forced colours (the selected tab alone underlined) | `src/app/globals.css`, `src/styles/components.css` | `apps/server/test/web/webChrome.browser.int.test.ts`; the accessibility suite (`npm run test:a11y`) |
| `UD-010` Page language; an activity title's own `lang` | `src/app/layout.tsx`, `src/i18n/`, `src/i18n/partLanguage.ts` | `test/i18n/translate.test.ts`, `test/i18n/partLanguage.test.ts`, `apps/server/test/web/webApp.browser.int.test.ts`, `webChrome.browser.int.test.ts` |
| `UD-013` Consistent help, accessible errors, a title per page (WCAG 2.4.2) | `src/components/SiteHeader.tsx`, `ErrorSummary.tsx`, `/hjelp`, `src/i18n/pageTitle.ts` | `test/components/SiteHeader.test.tsx`, `ErrorSummary.test.tsx`, `TextSections.test.tsx`, `test/i18n/pageTitle.test.ts`, `apps/server/test/web/webChrome.browser.int.test.ts` |
| `PROD-003`, `UD-022` Check and publish; a new reason for a published activity with an error that has no reason that holds | `src/features/activity/CheckPanel.tsx`, `src/components/PublishDialog.tsx`, `FindingsList.tsx` | `test/components/PublishDialog.test.tsx`, `test/features/CheckPanel.test.tsx`, `CheckPanelTransitions.test.tsx` |
| `PROD-011` Formative-use notice | `src/components/Notice.tsx` | `test/components/Notice.test.tsx` |
| `PROD-013`, `UD-006` The editor's save choice: the page inert around the frame while it is open (the frame's holders take no focus), «Lagre som ny versjon» opens the copy's Rediger tab | `src/messaging/useEditorSaveChoice.ts`, `inertOutside.ts`, `src/features/activity/useActivityEditor.ts`, `src/features/lti/LtiPlayView.tsx` | `test/features/ActivitySaveChoice.test.tsx`, `test/messaging/inertOutside.test.ts`, `test/messaging/frameMessages.test.ts` |
| `DATA-006` Privacy notice in the language of the linking page (`?lang=`), pinned to the data inventory | `/personvern`, `src/components/SiteFooter.tsx`, `src/features/info/privacySections.ts` | `test/components/TextSections.test.tsx`, `SiteFooter.test.tsx`, `test/features/privacyNotice.test.ts`, `privacyNoticeScope.test.ts`, `apps/server/test/web/webChrome.browser.int.test.ts` |
| `LTI-006`, `LTI-003` Canvas tabs, ltik in memory only | `src/app/app/play/page.tsx`, `src/features/lti/` | `test/features/LtiPlayView.test.tsx`, `test/lti/launchHeader.test.ts` |
| `DATA-011` First-party pages under a strict policy | `next.config.mjs`, `apps/server/src/web/` | `test/appStructure.test.ts`, `apps/server/test/web/webPages.browser.int.test.ts` |
| `PROD-012` Nynorsk first, nb and en | `src/i18n/` | `test/i18n/translate.test.ts` |
| `AUTH-003` No credentials or endpoints in the web app | `src/api/`, `apps/server/src/web/webRequestContract.ts` | `test/appStructure.test.ts`, `test/api/apiRequest.test.ts` |
| `UD-013`, `UD-006` The studio's main menu in the same place on every portal page; the current page marked | `src/components/StudioNav.tsx`, `SiteHeader.tsx` | `test/components/StudioNav.test.tsx`, `SiteHeader.test.tsx`, `apps/server/test/web/webPages.browser.int.test.ts` |
| `PED-003`, `PED-031` Studio filters and course in the address | `src/config/paths.ts`, `src/config/studioFilters.ts` | `test/config/paths.test.ts`, `test/config/studioFilters.test.ts` |
| `PED-002`, `PED-001` The guide page from the server's node tree: sections in order, boxes, citations into the reference list (a reference in another language with its own `lang`), external links, the draft banner, the phase matrix and the catalogue at their markers (or alone before a guide exists); phase labels from the content, read by every page through one call of `GET /api/studio` (`getStudioOverview`) | `src/features/studio/GuideView.tsx`, `guide/`, `PhaseMatrix.tsx`, `DraftBanner.tsx`, `src/api/studioApi.ts` | `test/features/GuideView.test.tsx`, `guideNodes.test.tsx`, `PhaseMatrix.test.tsx`, `studioPages.test.tsx`, `test/api/studioApi.test.ts` |
| `PED-003` The catalogue's filters read and write the address (`router.replace`), the count announced, focus kept, a no-match state | `src/features/studio/catalogue/` | `test/features/PatternCatalogue.test.tsx`, `catalogueFilter.test.ts` |
| `PED-010`, `PROD-001` A pattern's page and «Lag frå dette mønsteret» (signed out, learner, unavailable, author; pre-filled from `?fase=&emne=`; opens Rediger); shown without the overview too, with no phase named by its key and no phase choice | `src/features/studio/PatternDetailView.tsx`, `pattern/` | `test/features/PatternDetailView.test.tsx`, `PatternDetailFallback.test.tsx`, `studioPages.test.tsx` |
| `PED-030`, `UD-013`, `UD-006` The **Læringsdesign** tab: fieldsets (phase from content, course code with suggestions, outcomes with NKR category, outcomes already used in the course), counted rationale and purpose, minutes; error summary; save with the `updatedAt` read and a plain conflict message; add and remove move focus; the publish dialog's prompt never blocks (D-087) | `src/features/learningDesign/`, `src/features/activity/tabs/LearningDesignTab.tsx`, `CheckTab.tsx`, `src/api/learningDesignApi.ts` | `test/features/LearningDesignPanel.test.tsx`, `OutcomeFields.test.tsx`, `learningDesignForm.test.ts`, `LearningDesignPrompt.test.tsx` |
| `PED-031` The planner: course chooser from the author's codes, a captioned table with `th scope` in a focusable scrolling region, «Lag frå mønster» named with phase and outcome, gaps and untagged activities with icon and text (D-088) | `src/features/planner/` | `test/features/PlannerTable.test.tsx`, `PlannerView.test.tsx`, `studioPages.test.tsx` |
| `PED-032`, `UD-010` Time and purpose before the activity on **Spel** and in Canvas, the purpose in the activity's language | `src/components/LearnerInfo.tsx`, `src/features/activity/tabs/PlayTab.tsx`, `src/features/lti/LtiPlayView.tsx`, `src/lti/launchHeader.ts` | `test/features/learnerInfoViews.test.tsx`, `test/lti/launchHeader.test.ts` |
| `PROD-007`, `PROD-006`, `UD-006` The **Deling** tab: visibility saved with a button, co-authors (the owner's remove buttons, «Fjern meg», focus after add and remove), the people search (three characters, a pause, the count announced, the 429 explained), the bank listing with the consent required and the unmet conditions in words, «Lag ein kopi» opening the copy's Rediger tab; the content bank page with a copy button named after each activity, one status region for the page, and the student author's refusal; the attribution sign on a copy's page (D-090–D-092) | `src/features/sharing/`, `src/features/bank/`, `src/features/activity/SourceAttributionNote.tsx`, `src/features/activity/tabs/SharingTab.tsx`, `src/api/collaborationApi.ts` | `test/features/SharingPanel.test.tsx`, `CoAuthorSection.test.tsx`, `PeopleSearch.test.tsx`, `BankListingSection.test.tsx`, `BankView.test.tsx`, `SourceAttributionNote.test.tsx` |
| `AUTH-001` Author-only studio pages: sign-in and refusal | `src/components/AuthorGate.tsx`, `src/features/planner/`, `bank/`, `mappe/` | `test/components/AuthorGate.test.tsx`, `test/features/studioPages.test.tsx` |
| `MAPPE-001`, `MAPPE-002`, `MAPPE-004`, `UD-006` The `/mappe` page: filters by course, phase (labels from content) and change dates with the count announced; the picker (a fieldset of checkboxes, «select all» and «remove all», at most 50 with the reason in text); criteria set and language; the Del 1 word count announced politely with an icon and a text prefix; the Markdown and PDF downloads, the PDF 503s explained with a pointer to the Markdown file; the no-portfolio-yet state; the note that results come later (D-094, D-095) | `src/features/mappe/`, `src/api/mappeApi.ts` | `test/features/MappeView.test.tsx`, `MappeDownloads.test.tsx`, `mappeFilter.test.ts`, `studioPages.test.tsx` |
| `MAPPE-001`, `DOC-012` File answers and `DELETE` (D-099) | `src/api/apiRequest.ts`, `src/api/contentDisposition.ts` | `test/api/apiFileRequest.test.ts`, `test/api/apiRequest.test.ts` |
