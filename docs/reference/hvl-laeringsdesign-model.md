# Modellen for læringsdesign ved HVL: public evidence and phase wording

| | |
|---|---|
| **Stands in for** | `docs/reference/hvl-modellen-for-laeringsdesign.pdf` (internal ALU document, not public) |
| **Unblocks** | `content/laeringsdesign/phases.yaml` (spec 04 §1, `PED-001`) |
| **Compiled** | 2026-10-16 |
| **Status** | Partially found. The model's existence, purpose and structure are documented publicly. Its *phase* wording, if the model has any, is not. |

## 0. How this was gathered (provenance)

- The container proxy blocks `www.hvl.no`, `www.ntnu.no`, `app.cristin.no`, `api.cristin.no`, `nva.sikt.no`,
  `hvlopen.brage.unit.no`, `finn.no`, `arbeidsplassen.nav.no`, `web.archive.org`, `doi.org`, `api.crossref.org`
  and `api.openalex.org` (all tested; HTTP 403 or no connection). WebFetch also fails for them.
- **Primary source read directly:** HVL's *Årsrapport 2024*. The official copy is on hvl.no, but it is blocked here.
  The same PDF was downloaded from the public mirror used by the government's *Forvaltningsdatabasen* (Sikt):
  `https://sikt-fvdb-storage.s3.eu-north-1.amazonaws.com/aarsmeldinger/AN_2024_57478.pdf`
  (3 021 215 bytes, SHA-256 `923596f9717e743a88588b71dc8cc374d82a8e00eaf22d7a2250ee4cfd216254`). The title page reads
  "ÅRSRAPPORT 2024 HØGSKULEN PÅ VESTLANDET". The PDF is not committed to this repository (it is HVL's publication and is
  available at both URLs); re-download it and compare the SHA-256 above to verify the quote.
- **Everything else** comes from WebSearch result snippets of hvl.no and ntnu.no pages. The pages themselves could not be
  opened. Quotes marked *snippet* were returned verbatim by the search tool, but the full page was not seen.
  Confidence is capped at **medium** for these, or **low** where only one paraphrased snippet supports a claim.

## 1. Bottom line

1. **The model exists and is official.** HVL's 2024 annual report states that HVL has developed "ein modell for
   læringsdesign" and taught it to course leaders through a pilot Emnedesign module in autumn 2024 (§2.1, high).
2. **It is not described publicly as a before/during/after phase model.** The only public description is a 2025
   conference paper by its developers (Møgelvang & Isaksen, MNT-konferansen 2025). It describes a
   **contextual, knowledge-based alignment model** with three interdependent parts, ***kontekst*, *kunnskap* and
   *samskaping***. It applies across **levels**, from the single *læringsøkt* (micro) through the *emne* (meso) and the
   *studieprogram* up to the institution and society. It uses *baklengs planlegging*, *meningsskapende samsvar* and
   *den didaktiske relasjonsmodellen* (§2.2, medium).
3. **HVL does use our phase words, but as course-organisation vocabulary rather than as named model phases.** HVL course
   and module pages describe work around *samlingar* as **"før- og etterarbeid"**, **"forarbeid"** and
   **"mellomarbeid"**. In English they use **"pre- and post-work"** and **"intermediate work"** (§2.4, medium).
4. **Not found anywhere at HVL as a phase label:** *underveis* (as a phase), *førebuing*, *oppfølging*, or
   "før, under, etter". *Undervegsvurdering* exists, but it means formative assessment, which is a different concept.
5. **Recommendation:** keep the three stable keys. Change the `underveis` label to **Mellomarbeid**, the term HVL uses
   publicly, and shorten `etterarbeid` to **Etterarbeid**. Label the synchronous anchor **Samling**. Position HVL
   Interaktiv's phases explicitly at the model's *mikronivå* (the *læringsøkt*), not as "the phases of the model". Have
   ALU confirm this (§5, §6).

## 2. Findings with exact quotes

### 2.1 The model exists: HVL Årsrapport 2024, p. 23 (primary; **high**)

Source: PDF page 23, extracted with `pdftotext` (text lines 27–37). Official URL:
<https://www.hvl.no/siteassets/hvl-internett/dokument/rapport/arsrapport-hvl-2024.pdf>.

> **Modell for læringsdesign**
> Strukturar og samarbeidsformer i ein institusjon er sentralt i arbeidet med å fornye pedagogisk praksis i
> organisasjonen. HVL har utvikla ein modell for læringsdesign, og vidareformidla dette til emneansvarlege gjennom ein
> pilot med eigen modul om emnedesign i UH-pedagogikkkursa hausten 2024. Dette er basert på forsking som viser at det å
> skape samanheng i emne og studieprogram er noko av det viktigaste vi kan arbeide med for at utdanningane skal
> opplevast som meir meiningsfylte og engasjerande og dermed også auke studentgjennomstrøyminga.

Line-break hyphens from the two-column layout have been removed. The words are unchanged.

What this establishes: the official Nynorsk phrasing is "*modell for læringsdesign*", and the model is about
*samanheng i emne og studieprogram* (coherence). The report says nothing about phases.

### 2.2 What the model is: Møgelvang & Isaksen (2025)

Citation: Møgelvang, A. & Isaksen, (K.) R. (2025). *Utvikling av en kontekstuell og kunnskapsbasert modell for
læringsdesign*. Artikkelsamling for MNT-konferansen 2025, *Nordic Journal of STEM Education*, 9(2), 255–262. The paper
is written in Bokmål.

- PDF: <https://www.ntnu.no/documents/1358741858/1369576868/143.pdf/6bce847c-ac0b-f5ae-f297-731d3aca60f3?t=1743517848322>
- Cristin: <https://app.cristin.no/results/show.jsf?id=2368693>
- Proceedings issue: <https://www.ntnu.no/ojs/index.php/njse/issue/view/562>
- Listed on HVL's research group page: <https://www.hvl.no/forsking/gruppe/universitetspedagogikk/>

| Claim | Quote (snippet) | Confidence |
|---|---|---|
| Title and authors | "Utvikling av en kontekstuell og kunnskapsbasert modell for læringsdesign. Anja Møgelvang, Karl Robert Isaksen (2025)" (Cristin, HVL research-group page) | high (two independent listings agree) |
| Venue and pages | "Nordic Journal of STEM Education, 9(2), 255-262" (HVL research-group page) | medium |
| Three interdependent parts | "Under utviklingen av modellen fant vi at læringsdesign er iterativ og består av tre deler – kontekst, kunnskap og samskaping – som er avhengige av hverandre." | medium |
| Purpose and scope | "Modellen, som tar utgangspunkt i kontekst, kunnskap og samskaping, kan fungere som et godt verktøy for å sikre en helhetlig tilnærming til læringsdesign av studieprogrammer, emner og læringsøkter i høyere utdanning." | medium |
| Design needs aim and meaning | "Design av studieprogrammer, emner og sågar læringsøkter krever imidlertid en meget bevisst tilnærming. Først og fremst må vi ha en klar forståelse av mål og mening med læringsdesignet." | medium |
| Keywords | "Nøkkelord: Læringsdesign, Modellutvikling, Baklengs planlegging, Meningsskapende samsvar, Den didaktiske relasjonsmodellen" | medium |
| Levels (after Bronfenbrenner 2005) | Paraphrased in two separate searches: *mikronivå* = the single *læringsøkt*; *mesonivå* = the *emne*; *eksonivå* = the *studieprogram*; *utvidet eksonivå* = the institution; *makronivå* = the institution's place in society. *Baklengs planlegging* (Wiggins & McTighe 2005) starts at the *makronivå*. | medium for mikro and meso; low to medium for the rest (paraphrase only) |
| Figure 1 | Caption paraphrased as showing the interplay between the levels of learning design in higher education, adapted from Bronfenbrenner (2005). Not seen. | low |
| Model's display name | One snippet: "…ble resultatet en modell som vi valgte å kalle «HVL læringsdesign – kunnskapsbasert i alle ledd»". An exact-phrase search for "kunnskapsbasert i alle ledd" returned nothing. | **low** (unverified) |

**Implication:** the paper names no asynchronous or synchronous phases such as *forarbeid* or *etterarbeid* in anything
the search tool could see. HVL Interaktiv's phases belong to the model's **mikronivå** (*læringsøkt*): the work a
student does before, between and after a *samling*.

### 2.3 Emnedesign module (UPED854): how HVL names the model and alignment

Emneplan (nn, 2026/2027): <https://www.hvl.no/studier/studieprogram/emne/uped854>. English: <https://www.hvl.no/en/studies-at-hvl/study-programmes/courses/UPED854>
(also `/courses/2025/UPED854`) and <https://www.hvl.no/en/studies-at-hvl/study-programmes/course-design-module/>.

| Claim | Quote (snippet) | Confidence |
|---|---|---|
| Course aim, with the official Nynorsk term *læringsutbyttebeskrivingar* | "I dette emne får du utvikle ei medviten tilnærming til korleis du kan designe eit emne slik at det blir samsvar mellom læringsutbyttebeskrivingar, vurdering, læringsaktivitetar, føresetnadene til studentane og fagfellesskapet, samt rammevilkår." | medium |
| The model is referred to as «HVL læringsdesign» (lower-case *l*) | "drøftar eige emnedesign i lys av "HVL læringsdesign"" | medium |
| English wording used for the model | English course page (paraphrased by the search tool): students demonstrate "in-depth insight into the HVL model for learning design" or "the learning design model at HVL", and its importance for "alignment"/"consistency" in course design, and they "develop or revise courses that meet the requirements of the learning design model at HVL". | low to medium (the exact English sentence was not confirmed; an exact-phrase search for "HVL model for learning design" returned nothing) |
| Teaching forms (2026/2027) | "Studentaktive undervisnings- og læringsformer som diskusjon, gruppearbeid, presentasjonar, emnerevisjonssamlingar, førelesing, sjølvstudium og digitale læringsressursar." | medium |
| Compulsory activities | "Planleggje og gjennomføre to emnerevisjonssamlingar i eige fagmiljø og med studentar. Leggje fram tre presentasjonar på samlingane …" and "80% fysisk deltaking på samlingar totalt sett. 100% fysisk deltaking på samling 3." | medium |
| 2025/2026 version listed "forarbeid, mellomarbeid og etterarbeid" as teaching forms | Asserted once by a search summary. Not confirmed by later searches, and the 2026/2027 plan does not appear to contain it. | **low** |
| Emnedesign also offered as a *fagdidaktisk modul* (spring 2027) | "Dette emne er for undervisere som skal utvikle eller revidere emner." (<https://www.hvl.no/alu/universitetspedagogikk/fagdidaktiske-moduler/>) | medium |
| Place in the programme | "Valemne 2: Emnedesign (5 studiepoeng)" in *Universitetspedagogikk* (<https://www.hvl.no/studier/studieprogram/innforing-i-universitetspedagogikk/>) | medium |

### 2.4 Phase vocabulary HVL actually uses around *samlingar*

| HVL wording | Where | Quote (snippet) | Confidence |
|---|---|---|---|
| **før- og etterarbeid** (nn) | UPED851 *Innføring i universitetspedagogikk* (<https://www.hvl.no/studier/studieprogram/innforing-i-universitetspedagogikk/>, <https://www.hvl.no/studier/studieprogram/emne/2025/uped851/>) | "Emne er samlingsbasert og går over to samlingar med tilhøyrande før- og etterarbeid." | medium (an exact-phrase search matched both pages) |
| **pre- and post-work** (en) | English UPED851 page (<https://www.hvl.no/en/studies-at-hvl/study-programmes/introduction-to-teaching-and-learning-in-university-education/>) | "The subject is session-based and spans two sessions with associated pre- and post-work." | medium |
| **mellomarbeid** | FD6 *Undervisning for studentaktiv læring* (<https://www.hvl.no/studier/studieprogram/undervisning-for-studentaktiv-laring-modul/>), FD9 *Læringskultur i høyere utdanning* (<https://www.hvl.no/studier/studieprogram/laringskultur-i-hoyere-utdanning-modul/>), FD20 *Podcast* (<https://www.hvl.no/studier/studieprogram/podcast-modul/>) | FD9: "Modulen består av tre digitale møter og to mellomarbeid." | medium (several pages agree; the exact sentence for each page is not confirmed) |
| **intermediate work** (en) | English FD6 page (<https://www.hvl.no/en/studies-at-hvl/study-programmes/teaching-for-student-active-learning-module/>) | "three digital meetings + two intermediate work" | medium |
| **Forarbeid:** as a task heading | FD28 *Kunstig intelligens i arbeidshverdagen* (<https://www.hvl.no/studier/studieprogram/kunstig-intelligens-i-utdanning-modul/>) | "Forarbeid: Velg et tema knyttet til KI og din arbeidshverdag. …" | low to medium (one snippet) |
| **Før samlingen … Etter samlingen** (nb) | FHS8103 emneplan (<https://www.hvl.no/studier/studieprogram/emne/2024/FHS8103>) | "Før samlingen arbeider studentene individuelt med en kasuistikk… Etter samlingen arbeider studentene i grupper med kasuistikker" | low to medium |
| **mellom samlingane** | YFL814, MGBKHS201 emneplanar | "Utprøving i og kritisk analyse av eigen undervisningspraksis mellom samling ein og to." | medium |
| **samling / nettsamling**, **synkron / asynkron**, **ressursforelesing** | ALU: <https://www.hvl.no/alu/nettundervisning/nettundervisning/>, <https://www.hvl.no/alu/nettundervisning/synkron-nettundervisning/planlegg-nettundervisning/>, <https://www.hvl.no/student/a-vere-nettstudent/undervisningsformer-pa-nettsamlingar/> | "Kor stor del av undervisinga og læringsaktivitetane skal vere synkron og kor stor del skal vere asynkron?" and "…det er vanleg å forvente at dei gjennomfører den innan neste nettsamling." | medium |
| Canvas modules, activity *før og etter* | *Canvas for undervisere* (<https://www.hvl.no/alu/canvas-for-undervisere/>) | "Legg opp undervisninga i moduler. …" and "Bruk forumdiskusjoner for å aktivere studentene før og etter undervisningssekvensene." | medium |

**Searched for but not found** as HVL learning-design or phase terms (searches restricted to hvl.no and open-web, nn and nb):
*underveis* or *undervegs* as a phase name, *førebuing*, *oppfølging*, "før, under og etter", "forarbeid, mellomarbeid
og etterarbeid" (beyond the single low-confidence UPED854 claim), "mellomarbeid og etterarbeid", and
"Støtte til studentaktiv læring" (our planned guide title; no HVL page uses it).

### 2.5 Organisation and related terms

| Term in our docs | What HVL publicly uses | Source | Confidence |
|---|---|---|---|
| ALU, *Avdeling for utvikling av læring og undervisning* | Same. Page title "Avdeling for utvikling av læring og undervisning - Høgskulen på Vestlandet" | <https://www.hvl.no/alu/>, <https://www.hvl.no/alu/om-alu/> | high (page title, and our glossary agrees) |
| *Faggruppa digital læringsdesign* | Job ad: "**Faggruppa for digital læringsdesign**, i Avdeling for utvikling av læring og undervisning". The ALU staff list shows the role "Faggruppeansvarleg Digital læringsdesign". | <https://www.finn.no/446407671>, <https://arbeidsplassen.nav.no/stillinger/stilling/a6f44b85-59e6-4e16-b514-b4a858dcf8b5>, <https://www.hvl.no/alu/om-alu/> | medium |
| *Samsvar i emnedesign* | The exact phrase was not found on HVL pages. HVL writes "samsvar mellom læringsutbyttebeskrivingar, vurdering, læringsaktivitetar …" (UPED854), and the paper uses "meningsskapende samsvar" (Bokmål) as its term for constructive alignment. | §2.2, §2.3 | medium for the phrases quoted. The Nynorsk "meiningsskapande samsvar" was **not seen** (low). |
| *Læringsutbyttebeskriving* (nn) | "læringsutbyttebeskrivingar" (UPED854) | §2.3 | medium |
| *Læringsutbyttebeskrivelse* (nb) | Standard Bokmål. Appears in search paraphrases of UPED854 but was not seen verbatim on an HVL page. | — | low |
| *Emnedesign* | "Emnedesign (UPED854)", English "Course design" | §2.3 | high (several pages agree) |
| *Modellen for læringsdesign ved HVL* | "modell for læringsdesign" (Årsrapport 2024); «HVL læringsdesign» (UPED854) | §2.1, §2.3 | high and medium respectively |

## 3. Mapping: our keys to HVL's wording

| Our key | Our working label (spec 04 §1) | HVL public wording (nn / nb / en) | Same as ours? | Confidence |
|---|---|---|---|---|
| `forarbeid` | Forarbeid | "før- og etterarbeid" (nn, UPED851); "Forarbeid:" as a task heading (nb, FD28) / "pre-work" (from "pre- and post-work") | **Yes** | medium |
| *(not authored)* | Samling / synkron økt | *samling*, *samlingar*, *nettsamling*; *synkron* vs *asynkron* / "session(s)", "seminars" | **Yes** for *samling*. "Synkron økt" is not an HVL label; HVL says *synkron undervisning* or *nettsamling*. | medium |
| `underveis` | Underveis / mellomarbeid | *mellomarbeid* (FD6, FD9, FD20); "mellom samlingane" / "intermediate work". *Underveis* was not found as a phase name. | **Partly.** "Mellomarbeid" matches; "Underveis" does not. | medium |
| `etterarbeid` | Etterarbeid og eigenvurdering | "før- og etterarbeid" (nn); "Etter samlingen …" (nb) / "post-work". *Eigenvurdering* is not part of any HVL phase label seen. | **Yes** for "Etterarbeid". The suffix "og eigenvurdering" is ours. | medium |
| *(model level)* | — | Model levels: *læringsøkt* (mikro), *emne* (meso), *studieprogram* (ekso) … ; parts: *kontekst*, *kunnskap*, *samskaping* | Not a phase. Our three phases sit inside one *læringsøkt*/*emne*. | medium |

## 4. Answer to "does HVL use these words?"

- **forarbeid / etterarbeid:** yes. They are established HVL wording for work before and after a *samling*, usually as
  the compound "før- og etterarbeid". They are not documented as named phases of the learning-design model.
- **mellomarbeid:** yes. It is used on several university-pedagogy module pages for work between meetings.
- **underveis:** no evidence that it is used as a phase label. It risks confusion with *undervegsvurdering*
  (nn) / *underveisvurdering* (nb), which means formative assessment.
- **samling:** yes. HVL uses it everywhere, including *nettsamling* for online synchronous sessions.
- **før, under, etter / førebuing / oppfølging:** not found as HVL phase terms.

## 5. Proposed `content/laeringsdesign/phases.yaml`

This is a **proposal** until ALU confirms it. Each label carries a confidence comment. The description texts are **our own
wording** (editorial, not HVL quotes). A copy is in [`proposals/phases.yaml`](proposals/phases.yaml).

```yaml
# content/laeringsdesign/phases.yaml
# PROPOSAL 2026-10-16 — derived from PUBLIC HVL usage, NOT from the ALU model document.
# Replace/confirm when docs/reference/hvl-modellen-for-laeringsdesign.pdf arrives (spec 04 §1).
# Position: these phases sit at the model's mikronivå (læringsøkt) around a samling;
# they are not "the phases of HVL læringsdesign" (Møgelvang & Isaksen 2025 describe levels
# and the parts kontekst / kunnskap / samskaping, not phases).
version: 1
status: proposed            # proposed | confirmed-by-alu
anchor:
  key: samling              # synchronous session; shown on the studio page, never authored
  authored: false
  label:
    nn: Samling             # medium — HVL: "samling", "samlingar", "nettsamling"
    nb: Samling             # medium — HVL (nb pages): "samlingen"
    en: Session             # medium — HVL en: "two sessions with associated pre- and post-work"
  description:
    nn: Den synkrone økta – seminar, førelesing, lab eller nettsamling.
    nb: Den synkrone økten – seminar, forelesning, lab eller nettsamling.
    en: The synchronous session – seminar, lecture, lab or online session.
phases:
  - key: forarbeid
    order: 1
    position: before-samling
    label:
      nn: Forarbeid         # medium — HVL nn: "før- og etterarbeid"; module page heading "Forarbeid:"
      nb: Forarbeid         # medium — same word in nb
      en: Pre-work          # medium — HVL en: "pre- and post-work"
    description:
      nn: Asynkront arbeid før samlinga. Aktiver forkunnskapar, møt nøkkelomgrep og avdekk misoppfatningar.
      nb: Asynkront arbeid før samlingen. Aktiver forkunnskaper, møt nøkkelbegreper og avdekk misoppfatninger.
      en: Asynchronous work before the session. Activate prior knowledge, meet key concepts and surface misconceptions.
  - key: underveis          # key kept stable; label changed to HVL's public term
    order: 2
    position: between-samlingar
    label:
      nn: Mellomarbeid      # medium — HVL module pages (FD6, FD9, FD20): "mellomarbeid"
      nb: Mellomarbeid      # medium — same word in nb
      en: Intermediate work # medium — HVL en (FD6): "intermediate work"
    description:
      nn: Asynkront arbeid mellom samlingane og i praksis. Bearbeid, bruk og øv på profesjonell dømmekraft.
      nb: Asynkront arbeid mellom samlingene og i praksis. Bearbeid, bruk og øv på profesjonell dømmekraft.
      en: Asynchronous work between sessions and during placement. Process, apply and practise professional judgement.
  - key: etterarbeid
    order: 3
    position: after-samling
    label:
      nn: Etterarbeid       # medium — HVL nn: "før- og etterarbeid"
      nb: Etterarbeid       # medium — HVL nb: "Etter samlingen …"
      en: Post-work         # medium — HVL en: "pre- and post-work"
    description:
      nn: Konsolidering etter samlinga – repetisjon, gjenhenting og eigenvurdering mot læringsutbytet.
      nb: Konsolidering etter samlingen – repetisjon, gjenhenting og egenvurdering mot læringsutbyttet.
      en: Consolidation after the session – spaced retrieval and self-assessment against the learning outcomes.
```

Alternatives to put to ALU, if they prefer:
- `underveis`: nn/nb "Underveis" (our original label; low, since HVL usage was not found), or "Arbeid mellom samlingane".
- `etterarbeid`: keep "Etterarbeid og eigenvurdering" (nb "… og egenvurdering"), which is our own coinage (low).
- English `etterarbeid`: "Follow-up work" reads better than "Post-work" for UI, but HVL's own English uses "post-work".

## 6. Recommended spec and doc changes (not applied; the repository was not edited)

1. **Spec 04 §1.** The sentence "The phases and labels must match ALU's *Modellen for læringsdesign ved HVL* exactly"
   assumes the model defines phases. The public description shows a multi-level alignment model (kontekst, kunnskap,
   samskaping; mikro to makro). Proposed wording: "Phase labels follow HVL's established course-organisation
   vocabulary around *samlingar* (forarbeid, mellomarbeid, etterarbeid). HVL Interaktiv works at the model's
   *mikronivå* (the *læringsøkt*). ALU must confirm the labels against the model document."
2. **Spec 04 §1 table.** Change the `underveis` working label from "Underveis / mellomarbeid" to "Mellomarbeid", and the
   `etterarbeid` working label from "Etterarbeid og eigenvurdering" to "Etterarbeid". Move *eigenvurdering* into the
   description.
3. **Spec 04 §2 guide title.** The title uses "HVL Læringsdesign". HVL writes «HVL læringsdesign» (lower-case *l*,
   UPED854). Align the case. No HVL page uses the phrase "Støtte til studentaktiv læring".
4. **Spec 04 PED-002 item 5.** Name concrete links: the Emnedesign emneplan <https://www.hvl.no/studier/studieprogram/emne/uped854>
   and the ALU page <https://www.hvl.no/alu/>. Cite Møgelvang & Isaksen (2025) as the public reference for the model.
5. **`docs/GLOSSARY.md` line 19.** "Organises a course into asynchronous and synchronous phases" is not supported by
   public sources. Proposed: "HVL's model for learning design («HVL læringsdesign»). An alignment model built on three
   interdependent parts — *kontekst*, *kunnskap*, *samskaping* — applied across levels from the *læringsøkt* to the
   *studieprogram* and institution, using *baklengs planlegging* (Møgelvang & Isaksen 2025; HVL Årsrapport 2024 p. 23)."
6. **`docs/GLOSSARY.md` line 25.** Change "*Underveis* / *mellomarbeid*" to "*Mellomarbeid* (code key `underveis`)". Add a
   note that it is distinct from *undervegsvurdering*.
7. **`docs/GLOSSARY.md` line 12.** Change "*Faggruppa digital læringsdesign*" to "*Faggruppa for digital læringsdesign*",
   the wording used in the HVL job ad.
8. **`docs/GLOSSARY.md` line 20.** Add *meningsskapende samsvar* (nb, as used in the paper) next to *Samsvar i
   emnedesign*. "Samsvar i emnedesign" itself was not found verbatim at HVL.
9. **`docs/reference/README.md` row 2.** Record that a public, citable description exists (the NJSE 9(2) paper and Årsrapport
   2024 p. 23), and that the ALU PDF is still needed for exact phase wording, if it has any.

## 7. Could not be found

- The ALU model document, its figure, and any official list of phases or stages with exact Nynorsk and Bokmål wording.
- The full text of Møgelvang & Isaksen (2025). ntnu.no is blocked, so only search snippets were available, and Figure 1 was not seen.
- Verbatim confirmation of the display name «HVL læringsdesign – kunnskapsbasert i alle ledd».
- Verbatim English learning outcomes of UPED854.
- Whether UPED854 2025/2026 listed "forarbeid, mellomarbeid og etterarbeid".
- Any HVL use of *underveis*, *førebuing*, *oppfølging* or "før, under, etter" as phase names.
- Any Nynorsk rendering of *meningsskapende samsvar* used by HVL.

## 8. Source list (retrieved or searched 2026-10-16)

| # | Source | URL | Access |
|---|---|---|---|
| S1 | HVL Årsrapport 2024, p. 23 | <https://www.hvl.no/siteassets/hvl-internett/dokument/rapport/arsrapport-hvl-2024.pdf>; downloaded from <https://sikt-fvdb-storage.s3.eu-north-1.amazonaws.com/aarsmeldinger/AN_2024_57478.pdf> | **PDF read directly** (SHA-256 above) |
| S2 | Møgelvang & Isaksen (2025), MNT 2025 paper 143 | <https://www.ntnu.no/documents/1358741858/1369576868/143.pdf/6bce847c-ac0b-f5ae-f297-731d3aca60f3?t=1743517848322> | search snippets |
| S3 | Cristin result 2368693 | <https://app.cristin.no/results/show.jsf?id=2368693> | search snippets |
| S4 | NJSE 9(2) proceedings issue | <https://www.ntnu.no/ojs/index.php/njse/issue/view/562> | search snippets |
| S5 | HVL research group *Universitetspedagogikk* | <https://www.hvl.no/forsking/gruppe/universitetspedagogikk/>, <https://www.hvl.no/en/research/group/university-pedagogy/> | search snippets |
| S6 | Emneplan UPED854 Emnedesign | <https://www.hvl.no/studier/studieprogram/emne/uped854>; en: <https://www.hvl.no/en/studies-at-hvl/study-programmes/courses/UPED854>, <https://www.hvl.no/en/studies-at-hvl/study-programmes/courses/2025/UPED854>, <https://www.hvl.no/en/studies-at-hvl/study-programmes/course-design-module/> | search snippets |
| S7 | UPED851 / Innføring i universitetspedagogikk | <https://www.hvl.no/studier/studieprogram/innforing-i-universitetspedagogikk/>, <https://www.hvl.no/studier/studieprogram/emne/2025/uped851/>, <https://www.hvl.no/en/studies-at-hvl/study-programmes/introduction-to-teaching-and-learning-in-university-education/> | search snippets |
| S8 | Fagdidaktiske modular FD6, FD9, FD20, FD28 | <https://www.hvl.no/alu/universitetspedagogikk/fagdidaktiske-moduler/>, <https://www.hvl.no/studier/studieprogram/undervisning-for-studentaktiv-laring-modul/>, <https://www.hvl.no/en/studies-at-hvl/study-programmes/teaching-for-student-active-learning-module/>, <https://www.hvl.no/studier/studieprogram/laringskultur-i-hoyere-utdanning-modul/>, <https://www.hvl.no/studier/studieprogram/podcast-modul/>, <https://www.hvl.no/studier/studieprogram/kunstig-intelligens-i-utdanning-modul/> | search snippets |
| S9 | Emneplanar FHS8103, YFL814 | <https://www.hvl.no/studier/studieprogram/emne/2024/FHS8103>, <https://www.hvl.no/studier/studieprogram/emne/2023/YFL814> | search snippets |
| S10 | ALU pages | <https://www.hvl.no/alu/>, <https://www.hvl.no/alu/om-alu/>, <https://www.hvl.no/alu/nettundervisning/nettundervisning/>, <https://www.hvl.no/alu/nettundervisning/synkron-nettundervisning/planlegg-nettundervisning/>, <https://www.hvl.no/alu/canvas-for-undervisere/>, <https://www.hvl.no/student/a-vere-nettstudent/undervisningsformer-pa-nettsamlingar/> | search snippets |
| S11 | HVL job ad, *Faggruppa for digital læringsdesign* | <https://www.finn.no/446407671>, <https://arbeidsplassen.nav.no/stillinger/stilling/a6f44b85-59e6-4e16-b514-b4a858dcf8b5> | search snippets |
