# Glossary

Norwegian terms are given in Nynorsk (nn), with Bokmål (nb) in brackets where it differs. Code
uses the key in `monospace` (`DOC-009`).

## HVL and Norwegian higher education

| Term | Code key | Meaning |
|---|---|---|
| **HVL**, *Høgskulen på Vestlandet* | — | Western Norway University of Applied Sciences. Campuses in Bergen, Førde, Haugesund, Sogndal and Stord. |
| **ALU**, *Avdeling for utvikling av læring og undervisning* | — | HVL's unit for the development of learning and teaching. Owns learning-design guidance and universal design guidance for teaching. |
| *Faggruppa digital læringsdesign* | — | The digital learning design group in ALU. |
| **TeCopp** | — | HVL's cross-disciplinary team that manages Canvas, including LTI tool approval and testing. |
| *Pedagogisk akademi* | — | HVL's academy of merited teachers. |
| *Meritert undervisar* (nb: *underviser*) | — | Merited teacher, a formal recognition of excellent teaching. |
| *Opprykk* | — | Academic promotion. |
| *Pedagogisk mappe* | `pedagogiskMappe` | Teaching portfolio that documents practice and the reasoning behind it. Required for merit and promotion applications. |
| *Emnedesign* | — | Course design; also the name of HVL's course-design module for staff. |
| *Modellen for læringsdesign ved HVL* | — | HVL's model for learning design. Organises a course into asynchronous and synchronous phases. |
| *Samsvar i emnedesign* | — | Constructive alignment: outcomes, activities and assessment fit together (Biggs). |
| *Læringsutbytte*, *læringsutbyttebeskriving* (nb: *-beskrivelse*) | `laeringsutbytte` | Learning outcome(s), as written in the course plan. |
| *Kunnskap / ferdigheiter / generell kompetanse* (nb: *ferdigheter*) | `kunnskap`, `ferdigheiter`, `generellKompetanse` | The three outcome categories of the Norwegian Qualifications Framework (NKR). |
| *Forarbeid* | `forarbeid` | Asynchronous pre-work before a session. |
| *Samling* / *synkron økt* | — | The synchronous session: seminar, lecture, lab or online meeting. |
| *Underveis* / *mellomarbeid* | `underveis` | Asynchronous work between sessions or during placement. |
| *Etterarbeid* | `etterarbeid` | Asynchronous consolidation after a session. |
| *Eigenvurdering* (nb: *egenvurdering*) | — | Self-assessment. |
| *Undervegsvurdering* (nb: *underveisvurdering*) | — | Formative assessment. |
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
| **Deep Linking 2.0** | LTI flow where a teacher picks content in the tool, which is then placed in Canvas. |
| **AGS** | Assignment and Grade Services: the tool sends scores to the Canvas gradebook. |
| **NRPS** | Names and Role Provisioning Services: the tool can read course membership. We read counts only. |
| **ltik** | ltijs launch token. A signed token identifying one LTI launch. It replaces cookies inside the Canvas iframe. |
| **Developer Key** | Canvas's registration record for an LTI tool. |
| **OIDC / PKCE** | OpenID Connect login, and Proof Key for Code Exchange, which protects the authorisation-code flow. |
| **WCAG 2.2 AA** | Web Content Accessibility Guidelines, version 2.2, conformance level AA. |
| **DPIA** | Data Protection Impact Assessment (GDPR Art. 35). |
| **Pseudonym / HMAC** | A keyed hash that replaces a real identifier. It cannot be reversed without the secret key. |
| ***k*-suppression** | Hiding any statistic based on fewer than *k* people. |
| **JiTT** | Just-in-Time Teaching: using students' pre-work answers to plan the next class. |
