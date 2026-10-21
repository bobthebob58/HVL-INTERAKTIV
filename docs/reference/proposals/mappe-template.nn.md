---
# PROPOSAL for content/mappe/template.nn.md (MAPPE-002). NOT approved by ALU.
# Evidence and exact criterion texts: docs/reference/hvl-pedagogisk-mappe-criteria.md, compiled 2026-10-16
# from public HVL pages through web search. Anything marked (verify) must be confirmed by ALU before S5 relies on it.
# Placeholder syntax ({{...}}, {{#list}}...{{/list}}) is a proposal; the S5 implementation decides the engine.
id: pedagogisk-mappe
locale: nn
status: proposal
criteriaSet: hvl-merittering-2025     # (verify) HVL revises the criteria for every call; next call 2027
modes: [merittering, opprykk]         # opprykk mode: Del 1 headings UNCONFIRMED (see note in Del 1)
del1WordLimit: 7500                   # (verify) 2023 and 2025 calls: "inntil 7500 ord"; FAQ: references excluded
maxAttachments: 11                    # (verify) 2025 call: "inntil 11 vedlegg", one must be the manager's letter
minGroupSize: 5                       # k from INS-006 / MAPPE-003; never lower
---

# Pedagogisk mappe

{{forfattar}} · {{dato}}

> **Utkast frå HVL Interaktiv.** Dette er eit utgangspunkt, ikkje ei ferdig mappe. Tekst i *kursiv* er
> rettleiing som du byter ut med din eigen tekst. Tal frå studentane er anonymiserte samandrag for grupper
> med minst {{k}} studentar. Resultat frå H5P-aktivitetar er **formative** og er ikkje dokumentasjon av
> eksamensresultat.

<!-- PRIVACY: MAPPE-003. No learner identifiers, free-text answers or individual scores anywhere in this file.
     PEDAGOGY: formative-only invariant (CLAUDE.md §1); the notice above must stay. -->

## Lesarrettleiing: kriterium og dokumentasjon

<!-- criteria: ALL (2025 set: 1.1–1.4, 2.1–2.4, 3.1–3.3).
     WHY: published 2025 HVL portfolios use a criterion table as a reader's guide (Pavlova 2025, see criteria file §4).
     The criterion TEXTS are not hard-coded here. Proposed: render them from content/mappe/criteria.nn.yaml,
     keyed by criteriaSet, so a new call (2027) only needs a content change. -->

*Tabellen viser kvar i mappa kvart kriterium er svara på, og kva vedlegg som dokumenterer det. Fyll inn
vedlegga når du har valt dei.*

| Kriterium | Kvar i mappa | Vedlegg |
|---|---|---|
| 1.1 | Del 1, kap. 1 og 2.1 | {{vedlegg.k1_1}} |
| 1.2 | Del 1, kap. 2.2 | {{vedlegg.k1_2}} |
| 1.3 | Del 1, kap. 2.3 og aktivitetane i 3.3 | {{vedlegg.k1_3}} |
| 1.4 | Del 1, kap. 2.4 | {{vedlegg.k1_4}} |
| 2.1 | Del 1, kap. 3.1 | {{vedlegg.k2_1}} |
| 2.2 | Del 1, kap. 1 og 3.2 | {{vedlegg.k2_2}} |
| 2.3 | Del 1, kap. 3.3 | {{vedlegg.k2_3}} |
| 2.4 | Del 1, kap. 3.4 | {{vedlegg.k2_4}} |
| 3.1 | Del 1, kap. 4.1 | {{vedlegg.k3_1}} |
| 3.2 | Del 1, kap. 4.2 | {{vedlegg.k3_2}} |
| 3.3 | Del 1, kap. 4.3 | {{vedlegg.k3_3}} |

# Del 1 – Samanhengande framstilling

<!-- HVL merit call 2023 and 2025: "inntil 7500 ord". FAQ: "Referanser teller altså ikke med i ordbegrensningen".
     The app shows a live word count of Del 1 (excluding "Referansar").
     HVL allows Del 1 to follow the criteria or another order (low confidence); this template follows the criteria.
     OPPRYKK MODE (UNCONFIRMED): the 2025 qualification rules also use three parts ("Del 1: Sammenbindende
     fremstilling"), but the per-position criteria were not retrieved. For senior posts the rules name "formell
     opplæring, kvalitetsutvikling i egen undervisning, veiledning, og vesentlige bidrag til utvikling av
     utdanningskvalitet". Proposal: in opprykk mode, replace chapters 2–4 with those four headings, without a
     word limit, after ALU confirms. -->

*Ordtal: {{ordtal_del1}} av {{ordgrense}}. Referansane tel ikkje med.*

## 1 Mitt utgangspunkt: syn på undervisning og læringsdesign

<!-- criteria: 1.1, 2.2 · spec: MAPPE-002 item 1 (author writes it; this prompt is pre-filled) -->

*Skildra kort korleis du tenkjer om studentane si læring, og korleis du brukar «HVL læringsdesign» (kontekst,
kunnskap og samskaping) i emna dine, til dømes korleis forarbeid, samling, mellomarbeid og etterarbeid heng
saman. Kva for forsking og teori byggjer du på?*

## 2 Studentane sin læringsprosess

<!-- criteria: main criterion 1 (heading text for 2025 not retrieved verbatim: verify) -->

### 2.1 Erfaring med undervisning og rettleiing

<!-- criteria: 1.1 · data: {{emneoversikt}} = courses and the number of activities per phase; no learner data -->

*Kva emne og studentgrupper har du undervist og rettleidd? Korleis støttar praksisen din studentane sin
læringsprosess?*

{{emneoversikt}}

### 2.2 Systematisk utvikling over tid

<!-- criteria: 1.2 (also 3.3) · data: activity creation and revision dates, IF the app keeps them (verify) -->

*Kva har du endra i undervisninga di over tid, og kvifor? Vis gjerne til aktivitetar du har revidert, og til
korleis resultata endra seg etter revisjonen.*

### 2.3 Tilbakemeldingar frå studentar og kollegaer

<!-- criteria: 1.3 · data: k-suppressed aggregates (INS-*), misconception results (INS-003).
     PRIVACY: aggregates only, k >= {{k}}; never free text or individual scores (MAPPE-003). -->

*Korleis har du henta inn tilbakemeldingar frå studentar og kollegaer? Kva endra du som følgje av dei?
Samandraga frå aktivitetane i kapittel 3.3 kan brukast som dokumentasjon.*

### 2.4 Samarbeid om å utvikle undervisninga

<!-- criteria: 1.4 (2025 text known only as a paraphrase: verify) · data: number of co-owned activities -->

*Kven har du samarbeidd med om å utvikle undervisninga, til dømes studentar, kollegaer eller leiing? Kvifor
var samarbeidet viktig for resultatet?*

{{samarbeid_tal}}

## 3 Ei vitskapleg tilnærming til undervisning

<!-- criteria: main criterion 2 (heading text for 2025 not retrieved verbatim: verify) -->

### 3.1 Utforskande og systematisk utviklingsarbeid

<!-- criteria: 2.1 · data: misconception checks (ea-diagnose) and before/after comparisons, as aggregates -->

*Skildra eit utviklingsarbeid der du prøvde ut noko nytt, samla inn data og vurderte effekten. Kva var
spørsmålet ditt, kva gjorde du, og kva fann du ut?*

### 3.2 Val grunngjevne i forsking og teori

<!-- criteria: 2.2 · links to the research basis in spec 04 §3 (segment and retrieve; explain, don't just mark;
     spacing; practise judgement safely; alignment) -->

*Grunngje dei viktigaste vala dine med forsking og teori. Mønstra du har brukt, viser til forsking som du kan
byggje vidare på (sjå Referansar).*

### 3.3 Undervisnings- og vurderingsformer og varierte læremiddel

<!-- criteria: 2.3 (main home of the activity blocks), 1.1, 1.3.
     WHY: 2.3 names "varierte læremidler", and ALU says the portfolio covers educational technology (paraphrase).
     spec: MAPPE-002 item 2. -->

*Aktivitetane under er digitale læremiddel du har laga i HVL Interaktiv. Vel ut dei som best viser korleis du
utviklar og prøver ut undervisnings- og vurderingsformer.*

{{#aktivitetar}}

#### {{tittel}}

- **Innhaldstype:** {{innhaldstype}}
- **Fase:** {{fase}}
- **Emne:** {{emne}}
- **Læringsutbytte:** {{laeringsutbytte}}
- **Didaktisk grunngjeving:** {{grunngjeving}}
- **Universell utforming:** {{uu_status}}
- **Lenke:** {{lenke}}
- **Anonymisert resultat (formativt):** {{resultat}}

<!-- uu_status = validator result plus any acknowledgements with reasons (criteria 2.3).
     resultat = participants, completion rate, median attempts, change from first to last attempt (1.2, 1.3).
     PRIVACY: when fewer than k learners, render only "{{undertrykt_tekst}}" (e.g. "Færre enn 5 deltakarar –
     ikkje vist"). -->

*Refleksjon: Kva lærte du av denne aktiviteten, og kva vil du endre neste gong?*

{{/aktivitetar}}

### 3.4 Formidling av kompetanse frå undervisningsarbeidet

<!-- criteria: 2.4 ("formidlar kompetanse frå arbeid med undervisning på ulike måtar") -->

*Korleis har du delt det du har lært om undervisning, til dømes i artiklar, på konferansar, i rapportar eller
i interne forum?*

## 4 Kollegial haldning og erfaringsdeling

<!-- criteria: main criterion 3 -->

### 4.1 Deling og faglege fellesskap

<!-- criteria: 3.1 · data: activities or patterns shared with colleagues (counts) -->

*Korleis deler du erfaringar med leiing, kollegaer, studentar eller andre, og korleis har det bidrege til
faglege fellesskap om kvalitet i undervisninga?*

### 4.2 Studieplanarbeid og utviklingsarbeid

<!-- criteria: 3.2 -->

*Har du teke initiativ til, stått sentralt i eller leidd studieplanarbeid, pedagogisk eller fagdidaktisk
utviklingsarbeid eller studiekvalitetsarbeid? Korleis heng det saman med HVL sine strategiske planar?*

### 4.3 Grunngjeven plan for vidare utvikling

<!-- criteria: 3.3 (also 1.2) -->

*Kva vil du utvikle vidare i eiga undervisning og i fagmiljøet, og kvifor? Kva rolle ser du for deg som
merittert undervisar?*

## Referansar

<!-- criteria: 2.2 · pre-filled from the reference keys of the patterns the author used (spec 04 §3).
     Not counted in the Del 1 word limit (HVL FAQ). -->

{{referansar}}

# Del 2 – Pedagogisk CV: innspel

<!-- HVL 2025: "Søker kan enten bruke egen CV eller malen «Pedagogisk CV»". UNCONFIRMED: the headings of HVL's
     CV template were not retrieved; this block lists only entries that HVL Interaktiv can document. Map them to
     HVL's template once ALU provides it (verify). -->

*HVL har ein eigen mal for pedagogisk CV. Lim inn det som passar der.*

- **Utvikling av digitale læringsressursar:** {{aktivitetsliste_med_dato}}

# Del 3 – Forslag til vedlegg

<!-- HVL 2025: "inntil 11 vedlegg", "Ett av vedleggene må være anbefalingsbrev fra leder",
     "Alle vedlegg skal være vist til i den pedagogiske mappen". The CV and figures in the text do not count.
     The suggested types below come from HVL's 2025 list of example attachments. -->

*Du kan leggje ved inntil {{maks_vedlegg}} vedlegg. Eitt av dei må vere anbefalingsbrev frå leiar (bruk HVL
sin mal «Lederuttalelse»). Du må vise til alle vedlegga i Del 1.*

1. **Anbefalingsbrev frå leiar** *(obligatorisk. HVL Interaktiv lagar ikkje dette.)*
2. **Dokumentasjon og døme på utvikling av læringsressursar:** {{vedlegg_aktivitetar}}
   <!-- criteria: 2.3 · 2025 example type "dokumentasjon og eksempler på utvikling av læringsressurser" -->
3. **Samanstilling av og refleksjon over tilbakemeldingar** (anonymisert, minst {{k}} studentar per gruppe)
   <!-- criteria: 1.3 · 2025 example type "en bearbeidet sammenstilling av og refleksjon over studentevalueringer
        og andre tilbakemeldinger". PRIVACY: aggregates only. -->
