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
| *Pedagogisk mappe* | `pedagogiskMappe` | Teaching portfolio that documents practice and the reasoning behind it. Required for merit and promotion applications. For merit it has three parts: Del 1 *samanhengande framstilling* (nb: *sammenhengende fremstilling*), Del 2 *pedagogisk CV*, Del 3 attachments. |
| *Emnedesign* | — | Course design; also the name of HVL's course-design module for staff (UPED854). |
| *Modellen for læringsdesign ved HVL*, «HVL læringsdesign» | — | HVL's model for learning design. An alignment model built on three interdependent parts, *kontekst*, *kunnskap* and *samskaping*, applied across levels from the single *læringsøkt* (mikronivå) to the *emne*, *studieprogram* and institution, with *baklengs planlegging* (Møgelvang & Isaksen 2025). |
| *Meningsskapande samsvar* (nb: *meningsskapende samsvar*); *samsvar i emnedesign* | — | Constructive alignment: outcomes, activities and assessment fit together (Biggs). HVL describes it as *samsvar mellom læringsutbyttebeskrivingar, vurdering, læringsaktivitetar …* (UPED854). |
| *Baklengs planlegging* | — | Backward planning: start from the intended outcomes and design assessment and activities from them (Wiggins & McTighe). |
| *Læringsøkt* | — | A single learning session; the model's mikronivå, where HVL Interaktiv's activities sit. |
| *Læringsutbytte*, *læringsutbyttebeskriving* (nb: *-beskrivelse*) | `laeringsutbytte` | Learning outcome(s), as written in the course plan. |
| *Kunnskap / ferdigheiter / generell kompetanse* (nb: *ferdigheter*) | `kunnskap`, `ferdigheiter`, `generellKompetanse` | The three outcome categories of the Norwegian Qualifications Framework (NKR). |
| *Forarbeid* | `forarbeid` | Asynchronous pre-work before a session. |
| *Samling* / *nettsamling* | — | The synchronous session: seminar, lecture, lab or online meeting (*nettsamling*). |
| *Mellomarbeid* | `underveis` | Asynchronous work between sessions or during placement. The code key keeps its earlier name (D-019). |
| *Etterarbeid* | `etterarbeid` | Asynchronous consolidation after a session. |
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
| **Deep Linking 2.0** | LTI flow where a teacher picks content in the tool, which is then placed in Canvas. Canvas opens the tool from a placement with an `LtiDeepLinkingRequest` launch; the tool shows its picker (`/lti/deeplink` in S3) and returns the chosen activities as a signed `LtiDeepLinkingResponse` JWT to the platform's `deep_link_return_url` (`LTI-005`, D-061). |
| **AGS** | Assignment and Grade Services: the tool sends scores to the Canvas gradebook. |
| **NRPS** | Names and Role Provisioning Services: the tool can read course membership. We read counts only. |
| **ltik** | ltijs launch token: an RS256-signed JWT that holds only the ID of the stored launch record (`tid`) and is valid for 24 hours. It replaces cookies inside the Canvas iframe. It travels as `Authorization: Bearer`; only `/lti/play`, `/lti/deeplink`, `/h5p/ajax` and `/h5p/contentUserData/…` accept it in the query (D-058). It lives in page memory only, never in browser storage or logs, and the landing script removes it from the address bar (`LTI-003`). |
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
| **Signed file grant** | The part of a content-file URL `/h5p/files/<grant>/<contentId>/<file>` that authorises it: a key ID, an expiry and an HMAC over `contentId\|expiry` made with `URL_SIGNING_KEYS`. A player render issues it after the View check. It lasts 12 to 13 hours and names no person, so `<img>` and `<video>` tags work in a cookie-less iframe (D-058). |
| **Key ring** | An environment value `id=base64,id=base64,…` whose first key is current; older keys still verify or decrypt, so keys rotate without downtime when the new key is first added in second place and moved first only once every server holds it (the three steps are in D-056; D-055 and D-058 apply them to the other two rings). HKDF derives one key per purpose from each key. `IDENTITY_HASH_KEYS`: identity and audit-IP hashes (D-055). `DATA_ENCRYPTION_KEYS`: AES-256-GCM for LTI private keys, LTI access tokens and the session's Feide ID token (D-056). `URL_SIGNING_KEYS`: signed file grants (D-058). `PSEUDONYM_SECRETS` is keyed by academic year instead (`DATA-002`). |
| **WCAG 2.2 AA** | Web Content Accessibility Guidelines, version 2.2, conformance level AA. |
| **DPIA** | Data Protection Impact Assessment (GDPR Art. 35). |
| **Pseudonym / HMAC** | A keyed hash that replaces a real identifier. It cannot be reversed without the secret key. |
| ***k*-suppression** | Hiding any statistic based on fewer than *k* people. |
| **JiTT** | Just-in-Time Teaching: using students' pre-work answers to plan the next class. |
