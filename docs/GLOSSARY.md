# Glossary

Norwegian terms are given in Nynorsk (nn), with Bokmål (nb) in brackets where it differs. Code
uses the key in `monospace` (`DOC-009`).

## HVL and Norwegian higher education

| Term | Code key | Meaning |
|---|---|---|
| **HVL**, *Høgskulen på Vestlandet* | — | Western Norway University of Applied Sciences. Campuses in Bergen, Førde, Haugesund, Sogndal and Stord. |
| **ALU**, *Avdeling for utvikling av læring og undervisning* | — | HVL's unit for the development of learning and teaching. Owns learning-design guidance and universal design guidance for teaching. |
| *Faggruppa for digital læringsdesign* | — | The digital learning design group in ALU. |
| **TeCopp** | — | HVL's cross-disciplinary team that manages Canvas, including LTI tool approval and testing. |
| *Pedagogisk akademi* | — | HVL's pedagogical academy. Merited teachers become members. |
| *Merittert undervisar* (nb: *merittert underviser*) | — | Merited teacher, a formal recognition of excellent teaching. HVL calls for applications every other year (next call 2027). |
| *Opprykk* | — | Academic promotion. |
| *Pedagogisk mappe* | `mappe` | Teaching portfolio that documents practice and the reasoning behind it. Required for merit and promotion applications. For merit it has three parts: Del 1 *samanhengande framstilling* (nb: *sammenhengende fremstilling*), Del 2 *pedagogisk CV*, Del 3 attachments. In HVL Interaktiv the page `/mappe` (menu «Mappe», en "Portfolio") exports a draft of it from the author's own and co-authored activities, as Markdown to edit or as a tagged PDF (`MAPPE-001`…`MAPPE-004`, D-094); its template and criteria are in `content/mappe/`. |
| *Emnedesign* | — | Course design; also the name of HVL's course-design module for staff (UPED854). |
| *Modellen for læringsdesign ved HVL*, «HVL læringsdesign» | — | HVL's model for learning design. An alignment model built on three interdependent parts, *kontekst*, *kunnskap* and *samskaping*, applied across levels from the single *læringsøkt* (mikronivå) to the *emne*, *studieprogram* and institution, with *baklengs planlegging* (Møgelvang & Isaksen 2025). |
| *Meningsskapande samsvar* (nb: *meningsskapende samsvar*); *samsvar i emnedesign* | — | Constructive alignment: outcomes, activities and assessment fit together (Biggs). HVL describes it as *samsvar mellom læringsutbyttebeskrivingar, vurdering, læringsaktivitetar …* (UPED854). |
| *Baklengs planlegging* | — | Backward planning: start from the intended outcomes and design assessment and activities from them (Wiggins & McTighe). |
| *Læringsøkt* | — | A single learning session; the model's mikronivå, where HVL Interaktiv's activities sit. |
| *Læringsutbytte*, *læringsutbyttebeskriving* (nb: *-beskrivelse*) | `laeringsutbytte` | Learning outcome(s), as written in the course plan. |
| *Kunnskap / ferdigheiter / generell kompetanse* (nb: *ferdigheter*) | `kunnskap`, `ferdigheiter`, `generellKompetanse` | The three outcome categories of the Norwegian Qualifications Framework (NKR). |
| *Forarbeid* | `forarbeid` | Asynchronous pre-work before a session (en label "Pre-work"). The first of the studio's three phases; pattern IDs `fa-…`. Every phase label is read from `content/laeringsdesign/phases.yaml`, so ALU renames a phase without code (`PED-001`); code and the database know only the key. |
| *Samling* / *nettsamling* | `samling` | The synchronous session: seminar, lecture, lab or online meeting (*nettsamling*); en "Session". The anchor the three phases sit around (`anchor` in `phases.yaml`), shown as its own column in the phase matrix on `/laeringsdesign`; never authored. |
| *Mellomarbeid* | `underveis` | Asynchronous work between sessions or during placement (en label "Intermediate work"); pattern IDs `uv-…`. The code key keeps its earlier name (D-019). |
| *Etterarbeid* | `etterarbeid` | Asynchronous consolidation after a session (en label "Post-work"); pattern IDs `ea-…`. The planner marks a learning outcome with no Etterarbeid activity as a gap (D-088). |
| *Eigenvurdering* (nb: *egenvurdering*) | — | Self-assessment. |
| *Undervegsvurdering* (nb: *underveisvurdering*) | — | Formative assessment. Not a phase; do not confuse with *mellomarbeid*. |
| *Sluttvurdering* | — | Summative assessment (exam). Out of scope. |
| *Praksis* | — | Work placement (clinical, school, etc.). |
| *Profesjonell dømmekraft* | — | Professional judgement. |
| *Didaktisk skjønn* | — | Didactic discretion: a teacher's situated judgement about teaching. |
| **PPU** | — | *Praktisk-pedagogisk utdanning*, a one-year teacher-education programme. |
| **GLU** | — | *Grunnskulelærarutdanning*, primary and lower-secondary teacher education. |
| *Universell utforming* (UU) | — | Universal design. For ICT it is regulated by law. |
| **UUtilsynet** | — | The Norwegian authority that supervises universal design of ICT. |
| *uustatus.no* | — | The national portal where public bodies publish accessibility statements. |
| *Tilgjengelegheitserklæring* (nb: *tilgjengelighetserklæring*) | — | Accessibility statement. |
| **Feide** | — | The national login federation for Norwegian education, operated by **Sikt**. |
| *Nynorsk* (`nn`) / *Bokmål* (`nb`) | `nn`, `nb` | The two written standards of Norwegian. HVL uses Nynorsk as its main administrative language. |

## UI words used in HVL Interaktiv

| UI text (nn) | Meaning |
|---|---|
| *Innsikt* | Insight (teacher analytics) |
| *Før samlinga* | "Before the session" (the default insight view) |
| *Ta opp i samlinga* | "Bring to the session" (shortlist button) |
| *Rediger* | Edit |
| *Riktig / Feil* | Correct / Incorrect (feedback prefixes) |
| *Hjelp* | Help |
| *Personvern* | Privacy (the footer link to the privacy page, `DATA-006`) |
| *Utkast* / *Publisert* | Draft / Published: an activity's two states. Learners and Deep Linking see published activities only (`PROD-003`, `PROD-004`) |
| *Publiser* / *Gjer om til utkast* (nb: *Gjør om til utkast*) | Publish / Turn back into a draft (unpublish) |
| *Sjekk* | The pre-publish check: the validator's findings for one activity (`UD-020`) |
| *Grunngjeving* (nb: *begrunnelse*) | The author's reason for publishing despite an error; stored as a `ValidationAcknowledgement` and valid for 14 days (`UD-022`, D-074) |
| *Grunngje på nytt* (nb: *Begrunn på nytt*) | "Explain again": new reasons for a published activity with an error that has no reason that holds; the same publish request, and the activity stays published (D-074 amendment) |
| *Gå til feltet* | "Go to the field": the link from a finding to the field in the editor (`UD-021`) |
| *Eigar* / *Medforfattar* (nb: *Eier* / *Medforfatter*) | Owner / Co-author of an activity. A co-author may edit, publish and share it (`ContentCollaborator`, role `coauthor`). On the **Deling** tab the owner adds co-authors by name or Feide ID from HVL staff authors only, at most 20, and a co-author may remove themselves (`PROD-007`, D-090) |
| *Læringsdesign* / *Deling* | The activity page's **Learning design** and **Sharing** tabs (S5, D-089): see the studio section below; *Deling* holds visibility, co-authors, the content bank listing and «Lag ein kopi» |
| *Lagre som ny versjon* | "Save as new version": in the editor's save choice, when a structural change would reset other people's saved progress, the change is saved as a private copy and the original and its learner state stay untouched (portal only; `PROD-013`, D-093). The other choices are «Nullstill framgangen og lagre» (nb: «Nullstill fremgangen og lagre») and «Avbryt» |

## The læringsdesign studio and the pedagogisk mappe (Session 5)

The studio's own words, as the pages show them in Nynorsk, with Bokmål where it differs and the English UI text in
the meaning. Spec 04 and D-082…D-100 hold the rules; ALU edits the texts behind them in `content/`.

| Term | Code key | Meaning |
|---|---|---|
| *Læringsdesign-rettleiinga* (nb: *-veiledningen*) | `guide.{nn,nb,en}.md` | **The guide** on the public page `/laeringsdesign` (menu «Læringsdesign», en "Learning design"): why asynchronous work often fails, «HVL læringsdesign» in brief, three mechanisms each with a box «Kva dette betyr for aktiviteten din» (nb: «Hva dette betyr for aktiviteten din», en "What this means for your activity"), the phase matrix and the pattern catalogue, and where to get help (`PED-002`). ALU's Markdown, shown through a closed node tree (D-083). |
| *Mønster* (nb: plural *mønstre*) | `patternId`; `content/laeringsdesign/patterns/<id>/` | **Pattern**: a tried way of building one kind of activity: what it is for, when to use it, an example, why it works (with research references), build and student minutes, and a skeleton the new activity starts from (spec 04 §4, `PED-010`, D-084). ALU adds a pattern as a folder, with no code (`PED-011`). Each pattern has its page `/laeringsdesign/monster/<id>` with «Lag frå dette mønsteret» (nb: «Lag fra dette mønsteret», en "Create from this pattern"), which creates a private draft in one request (`PROD-001`, D-085). |
| *Mønsterkatalog* (nb: same) | `#monsterkatalog`; `?fase=&type=&tid=&emne=` | **Pattern catalogue**: the patterns on `/laeringsdesign`, headed «Mønsterkatalogen», filtered by phase, content type and longest build time. The filters live in the address, so a shared link restores them (`PED-003`); the guide places the catalogue with its `{{pattern-catalogue}}` marker. |
| *Plassheldar* (nb: *plassholder*) | `⟦…⟧`; `V-PLACEHOLDER` | **Placeholder**: guidance a pattern's skeleton puts where the author's own content goes, wrapped in `⟦` and `⟧` (U+27E6, U+27E7). The pages call it «rettleiing frå mønsteret» (nb: «veiledning fra mønsteret», en "guidance from the pattern"). The validator rule V-PLACEHOLDER reports every field that still holds one, and an empty video or background image, as an error that can be published past only with a reason (D-086, D-074). |
| *Læringsdesign-fana* (nb: *Læringsdesign-fanen*) | `?fane=learning-design` | **Learning design tab** («Læringsdesign», en "Learning design") on an activity's page `/aktivitet/<id>`, for the people who may edit it: phase, course code (*emnekode*), learning outcomes with their NKR category, the didactic rationale (*grunngjeving*), the student minutes and the one-line purpose students see before they start (`PED-030`, `PED-032`, D-087). The publish dialog asks for it but never blocks. |
| *Planleggar* (nb: *planlegger*) | `/laeringsdesign/planlegg`; `planner` | **Alignment planner** (UI en "Planner"): for one course code, a table of the author's learning outcomes × the three phases, built from their own and co-authored activities. It marks two gaps with an icon and a text: an outcome with no Etterarbeid activity, and a phase with no activity. An empty cell offers «Lag frå mønster» (`PED-031`, D-088). Authors only. |
| *Innhaldsbank* (nb: *innholdsbank*) | `/laeringsdesign/innhaldsbank`; `H5PContent.bankListedAt` | **Content bank**: published activities, shared with HVL or wider, that their owners have listed so that colleagues can copy and adapt them (`PROD-007`, D-091). Listing needs the owner's consent to a text that is a draft for ALU and HVL's lawyers (Q17); unpublishing the activity or making it private takes it out. Only HVL staff authors see it, list in it and copy from it, because it shows colleagues' names. |
| *Kopi* / *kjelde* (nb: *kopi* / *kilde*) | `sourceContentId`, `sourceAuthorUserId` | **Copy** / **source**: «Lag ein kopi» (nb: «Lag en kopi», en "Make a copy", on the **Deling** tab and in the content bank) and «Lagre som ny versjon» make a private draft that remembers the activity it came from and that activity's author. The copy's page shows «Kopi av «tittel» av namn» (en: Copy of “title” by name) to the people who may edit it: the source attribution (D-092). Learner data, co-authors, placements and the bank listing are never copied. |
| *Lesarrettleiing* (nb: *leserveiledning*) | `{{lesarrettleiing}}` | **Reader's guide** at the start of the pedagogisk mappe: a table of every criterion of the chosen criteria set, where in the portfolio it is answered and which attachment documents it. The server builds it from the criteria file, not from the template, and its words do not count in Del 1 (`MAPPE-002`, D-094). |
| *Del 1* (en: Part 1) | `{{del1_start}}` … `{{del1_slutt}}` | The first part of a merit portfolio, *samanhengande framstilling* (nb: *sammenhengende fremstilling*, en "continuous text"); Del 2 is the *pedagogisk CV* (teaching CV) and Del 3 the attachments (*vedlegg*). The export counts the words between the two markers only, without the reader's guide and the references, against the set's limit (7 500 in HVL's 2025 call, *(verify)*; D-094). |
| *Kriteriesett* (nb: same) | `criteria.{nn,nb,en}.yaml`; `hvl-merittering-2025` | **Criteria set**: the merit criteria of one HVL call (1.1–3.3 in 2025), with that call's limits for Del 1 words and attachments. The author chooses the set on `/mappe`; another set changes every criterion text, the reader's guide and the limits, with no code change (`MAPPE-002`). |

## Technical terms

| Term | Meaning |
|---|---|
| **H5P** | Open-source framework for interactive HTML5 learning content. Content is a JSON parameter object (`content.json`) rendered by a *content type* library. |
| **Content type / library** | A versioned H5P package such as `H5P.MultiChoice 1.16`. *Runnable* libraries can be authored directly; others are dependencies. |
| **Core API version** | The H5P core contract version (here 1.28). Libraries declare the core version they need. |
| **H5P Hub** | H5P's registry of content types (`hub-api.h5p.org` from 2026). |
| **Lumi h5p-server** | `@lumieducation/h5p-server`, a Node.js re-implementation of H5P's server side. |
| **xAPI statement** | An "actor – verb – object – result" record emitted by H5P when a learner interacts. |
| **LTI 1.3 / LTI Advantage** | 1EdTech standard for launching tools from an LMS. *Advantage* adds Deep Linking, Assignment and Grade Services, and Names and Role Provisioning. |
| **Platform / Tool** | In LTI, Canvas is the *platform* and HVL Interaktiv is the *tool*. |
| **Deployment (LTI)** | One installation of a developer key in a Canvas account or course, named by the `deployment_id` claim; a platform can have several. Only deployments listed in `LTI_PLATFORMS` (stored as `LtiDeployment` rows) may launch the tool. ltijs does not check this itself (D-051). |
| **Placement (Canvas)** | Where Canvas offers a tool, set per developer key. Ours: `assignment_selection` (an assignment's external tool; the only one that creates a gradebook column), `link_selection` (a module item) and `editor_button` (the rich content editor). The custom field `hvl_placement` repeats the placement's name, for launches where Canvas's own placement claim is missing (D-061). Not the same as an `LtiPlacement` row, which records one activity placed in one course through one resource link (`LTI-006`). |
| **Deep Linking 2.0** | LTI flow where a teacher picks content in the tool, which is then placed in Canvas. Canvas opens the tool from a placement with an `LtiDeepLinkingRequest` launch; the tool shows its picker (`/lti/deeplink`, server-rendered, D-067) and returns the chosen activities as a signed `LtiDeepLinkingResponse` JWT to the platform's `deep_link_return_url` (`LTI-005`, D-061). |
| **AGS** | Assignment and Grade Services: the tool sends scores to the Canvas gradebook. |
| **NRPS** | Names and Role Provisioning Services: the tool can read course membership. We read counts only. |
| **ltik** | ltijs launch token: an RS256-signed JWT that holds only the ID of the stored launch record (`tid`) and is valid for 24 hours. It replaces cookies inside the Canvas iframe. It travels as `Authorization: Bearer`; only `/app/play`, `/lti/play`, `/lti/edit`, `/lti/deeplink`, `/h5p/ajax` and `/h5p/contentUserData/…` accept it in the query (D-058, D-069). It lives in page memory only, never in browser storage or logs, and the landing script removes it from the address bar (`LTI-003`). |
| **Recovery token (ltijs)** | A value ltijs 7 makes at the OIDC login step: an HMAC-signed state ID that expires after 10 minutes. The browser keeps it in the tool frame's `localStorage` or, where that storage is blocked, in LTI Platform Storage, and posts it back with the launch, so ltijs can match the launch to its login without a cookie. It grants nothing on its own; the ltik is never stored this way (D-050). |
| **LTI Platform Storage** | The 1EdTech LTI client-side postMessage API: the tool frame asks a sibling frame of the platform, named by `lti_storage_target` at login initiation (Canvas serves it from `sso.canvaslms.com`), to keep a value for it (`lti.put_data`, `lti.get_data`). ltijs uses it for its recovery token when the browser blocks storage in third-party frames; with storage blocked and no `lti_storage_target`, the launch fails (D-050). |
| **Developer Key** | Canvas's registration record for an LTI tool: its URLs, scopes, placements, privacy level and custom fields. Ours is `docs/reference/canvas-lti13-developer-key.json`; the client ID Canvas gives it goes into `LTI_PLATFORMS`. |
| **`feide_login`** | A custom field in our developer key, `$Canvas.user.loginId`, set on the Deep Linking placements only. The server reads it only for authors and only from platforms with `"feideLinking": true` in `LTI_PLATFORMS`, ignores an unexpanded `$…` value, uses it to join the teacher's Canvas identity to the account of an earlier Feide login, and never stores it (`AUTH-005`, D-052, D-063). |
| **OIDC / PKCE** | OpenID Connect login, and Proof Key for Code Exchange, which protects the authorisation-code flow. |
| **Feide ID** | A person's Feide identifier (`eduPersonPrincipalName`, e.g. `name@hvl.no`) in the claim `https://n.feide.no/claims/eduPersonPrincipalName` (scope `userid-feide`). It is the Feide subject in HVL Interaktiv: trimmed and lower-cased, then only hashed (`Identity.subjectHash`, the learnerKey) or compared (`ADMIN_FEIDE_IDS`, `feide_login`), never stored (D-054). |
| **Groups API (Feide)** | Feide's API for a user's groups: `GET https://groups-api.dataporten.no/groups/me/groups` with the user's access token. The organisation group `fc:org:<realm>` carries `membership.affiliation` (e.g. `employee`, `student`); FS course groups look like `fc:fs:fs:emne:<realm>:<code>:<version>`. Roles are computed from it at login; if the call fails, the login fails (`AUTH-002`, D-054). |
| **Login transaction** | One Feide login in progress: its `state`, `nonce`, PKCE verifier and checked return path, kept in Redis for at most 10 minutes and bound to the browser by the `__Host-hvli_login` cookie. The callback consumes it once, so a callback replayed or forced on another browser completes no login (D-057). |
| **Portal session** | The server-side session after a Feide login: a Redis record behind the opaque `__Host-hvli_sid` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`), ended by logout, after 2 hours without a request or 12 hours after login. It holds the user ID, roles, learnerKey, CSRF token and the encrypted Feide ID token, never a name or Feide ID (`AUTH-003`, D-057). |
| **CSRF token (synchronizer)** | One random token per portal session that requests must send back, in the `X-CSRF-Token` header, a `csrf` query value (H5P URLs) or a `csrf` form field. Required for every unsafe method and for any request to `/h5p/ajax` and `/h5p/contentUserData`; page scripts read it from `GET /auth/session`. A missing or wrong token gives 401 `hvl:csrf-invalid` (D-057). |
| **Principal** | Who a request acts for, in the same shape for both entry points: user ID, learnerKey, roles, mode (`portal` or `lti`), locale and, for LTI, the launch facts (`apps/server/src/auth/Principal.ts`). Built from the portal session or the ltik; it never holds a name, e-mail, Feide ID, LTI `sub` or token (spec 02 §2, D-053). |
| **Signed file grant** | The part of a content-file URL `/h5p/files/<grant>/<contentId>/<file>` that authorises it: a key ID, an expiry and an HMAC over `contentId\|expiry` made with `URL_SIGNING_KEYS`. A player render issues it after the View check, and the editor page after the Edit check (D-069). It lasts 12 to 13 hours and names no person, so `<img>` and `<video>` tags work in a cookie-less iframe (D-058). An editor's fresh uploads load through an upload grant of the same form, `/h5p/uploads/<grant>/<accountId>/<file>`, an HMAC over `accountId\|expiry` under its own HKDF purpose (`temporary-file-url`), so neither kind of grant opens the other (D-069). |
| **Key ring** | An environment value `id=base64,id=base64,…` whose first key is current; older keys still verify or decrypt, so keys rotate without downtime when the new key is first added in second place and moved first only once every server holds it (the three steps are in D-056; D-055 and D-058 apply them to the other two rings). HKDF derives one key per purpose from each key. `IDENTITY_HASH_KEYS`: identity and audit-IP hashes (D-055). `DATA_ENCRYPTION_KEYS`: AES-256-GCM for LTI private keys, LTI access tokens and the session's Feide ID token (D-056). `URL_SIGNING_KEYS`: signed file grants (D-058) and editor upload grants, each under its own HKDF purpose (D-069). `PSEUDONYM_SECRETS` is keyed by academic year instead (`DATA-002`). |
| **Design token** | A named brand value (colour, spacing, type) in `packages/design-tokens/tokens.json`. Code uses only the generated CSS variables (`--hvl-…`) and Tailwind classes; colour literals elsewhere fail Stylelint and ESLint (`UD-001`, D-072). |
| **Daylight theme** | H5P Core 1.28's theme, configured through `--h5p-theme-*` CSS variables. `packages/design-tokens` maps HVL tokens onto them (`h5p-daylight.css`), and `hvl-h5p-theme.css` adds typography, focus, targets and feedback prefixes on top (`UD-011`). |
| **Finding** | One result of the pre-publish check: rule ID, severity (`error`, `warning`, `hint`), the path of the field in `content.json` and a message in the author's language. Only errors block publishing (`UD-020`, `UD-021`, `PED-020`). |
| **Chrome page** | A Next.js page of `apps/web` (header, tabs, notices, footer) that frames an H5P player or editor page served by Express on the same origin (D-067). |
| **Nonce (CSP)** | A random value made for each response and named in its `script-src`; only scripts carrying it run. Next.js pages use one; H5P pages use `'self'` and a hash instead, because H5P writes `<script>` tags a nonce cannot reach (D-070). |
| **WCAG 2.2 AA** | Web Content Accessibility Guidelines, version 2.2, conformance level AA. |
| **DPIA** | Data Protection Impact Assessment (GDPR Art. 35). |
| **Pseudonym / HMAC** | A keyed hash that replaces a real identifier. It cannot be reversed without the secret key. |
| ***k*-suppression** | Hiding any statistic based on fewer than *k* people. |
| **JiTT** | Just-in-Time Teaching: using students' pre-work answers to plan the next class. |
