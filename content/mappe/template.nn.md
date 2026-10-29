<!--
  content/mappe/template.nn.md: the Nynorsk template of the pedagogisk mappe export (spec 04 §7, MAPPE-002, D-094).

  DRAFT. Written in S5 (2026-10-29) from docs/reference/proposals/mappe-template.nn.md. ALU has not confirmed it yet
  (open question Q17). The HVL rules quoted in these notes come from docs/reference/hvl-pedagogisk-mappe-criteria.md,
  which was compiled on 2026-10-16 from public HVL pages through web search. It is not the ALU document, so every
  value marked (verify) there stays to verify.

  How to edit: content/mappe/README.md lists the values, lists and markers. The Bokmål and English templates must have
  the same markers, lists, values and headings. Run `npm run content:check` after every change.

  The criterion texts, the word limit and the attachment limit are not written here: they come from
  criteria.nn.yaml, so a new call (the next is in 2027) needs no change to this file.

  PRIVACY (MAPPE-003): no learner identifiers, free-text answers or individual scores anywhere in this file.
  PEDAGOGY: H5P results are formative only (CLAUDE.md §1); the notice under the title must stay.
-->

# Pedagogisk mappe

{{forfattar}} · {{dato}}

> **Utkast frå HVL Interaktiv.** Dette er eit utgangspunkt, ikkje ei ferdig mappe. Tekst i *kursiv* er
> rettleiing som du byter ut med din eigen tekst. Tal frå studentane er anonymiserte samandrag for grupper med
> minst {{k}} studentar. Resultat frå H5P-aktivitetar er formative og er ikkje dokumentasjon av eksamensresultat.

<!-- HVL 2025 call: "kriteriene er revidert til denne utlysningen og ikke er identiske med kriteriene ved tidligere
     utlysninger" (hvl-pedagogisk-mappe-criteria.md §2, high). -->

*Kriteria i denne mappa er frå kriteriesettet «{{kriteriesett}}». HVL reviderer kriteria til kvar utlysing. Sjekk
difor kriteria, ordgrensa og talet på vedlegg i utlysinga du søkjer på.*

## Lesarrettleiing: kriterium og dokumentasjon

<!-- criteria: all of the set. WHY: published HVL portfolios use a criterion table as a reader's guide (Pavlova 2025,
     hvl-pedagogisk-mappe-criteria.md §4, medium). The server builds the table from criteria.nn.yaml (D-094); the
     reader's guide stands before Del 1, so the word count never includes it. -->

*Tabellen viser kvar i mappa du svarar på kvart kriterium, og kva vedlegg som dokumenterer det. Fyll inn vedlegga
når du har valt dei.*

{{lesarrettleiing}}

{{del1_start}}

# Del 1 – Samanhengande framstilling

<!-- HVL 2023 and 2025 calls: "inntil 7500 ord" (high). FAQ: "Referanser teller altså ikke med i ordbegrensningen på
     7500 ord i del 1" (medium). The References chapter therefore stands after the marker that ends Del 1.
     HVL lets Del 1 follow the criteria or another order (low); this template follows the criteria. -->

*Ordtal for Del 1: {{ordtal_del1}} av {{ordgrense}} ord. Referansane tel ikkje med i ordgrensa. Talet gjeld fila
slik HVL Interaktiv laga ho, med rettleiinga i kursiv. Tel orda på nytt når du har skrive teksten din.*

## 1 Mitt syn på undervisning og læringsdesign

<!-- criteria: 1.1, 2.2 · spec 04 §7: the teacher's learning-design approach opens the text.
     The model's three parts kontekst, kunnskap and samskaping: Møgelvang & Isaksen 2025 (references.yaml
     mogelvang2025; docs/reference/hvl-laeringsdesign-model.md). -->

*Fortel kort korleis du tenkjer om læringa til studentane. Korleis brukar du modellen for læringsdesign ved HVL,
med kontekst, kunnskap og samskaping, når du planlegg emna dine? Korleis heng arbeidet før, i og etter samlingane
saman? Kva forsking og teori byggjer du på?*

## 2 Læringsprosessen til studentane

<!-- criteria: main criterion 1. Its exact 2025 heading was not retrieved (verify); the 2023 wording is "søkeren
     over tid vektlegger studentenes læringsprosess i planlegging, gjennomføring og vurdering av undervisning". -->

### 2.1 Erfaring med undervisning og rettleiing

<!-- criteria: 1.1 · data: the courses and the number of activities per phase; no learner data. -->

*Kva emne og studentgrupper har du undervist og rettleidd? Korleis støttar praksisen din læringsprosessen til
studentane?*

Aktivitetane i mappa per emne, med talet på aktivitetar og kor mange det er i kvar fase:

{{#emneoversikt}}
- **{{emnekode}}:** {{tal}} ({{fasar}})
{{/emneoversikt}}

### 2.2 Systematisk utvikling over tid

<!-- criteria: 1.2 (also 3.3) · data: when each activity was made and last changed, in chapter 3.3. -->

*Kva har du endra i undervisninga di over tid, og kvifor? Vis gjerne til aktivitetar du har revidert. Under kvar
aktivitet i kapittel 3.3 står det når du laga han, og når du sist endra han.*

### 2.3 Tilbakemeldingar frå studentar og kollegaer

<!-- criteria: 1.3 · PRIVACY: aggregates only, for groups of at least k students (MAPPE-003). -->

*Korleis hentar du inn tilbakemeldingar frå studentar og kollegaer? Kva har du endra på grunn av dei? Samandraga
frå aktivitetane i kapittel 3.3 kan vere ein del av dokumentasjonen.*

### 2.4 Samarbeid om å utvikle undervisninga

<!-- criteria: 1.4 (its 2025 text is known only as a paraphrase: verify) · data: activities with co-authors. -->

*Kven har du samarbeidd med om å utvikle undervisninga, til dømes studentar, kollegaer eller leiinga? Kvifor var
samarbeidet viktig?*

Du har laga {{samarbeid_tal}} av dei {{aktivitetar_tal}} aktivitetane i mappa saman med medforfattarar.

## 3 Ei vitskapleg tilnærming til undervisning

<!-- criteria: main criterion 2. Its exact 2025 heading was not retrieved (verify); the 2023 wording is "viser en
     systematisk, forskende og vitenskapelig tilnærming til undervisning". -->

### 3.1 Utforskande og systematisk utviklingsarbeid

<!-- criteria: 2.1 -->

*Fortel om eit utviklingsarbeid der du prøvde ut noko nytt, samla inn data og vurderte effekten. Kva var spørsmålet
ditt, kva gjorde du, og kva fann du ut?*

### 3.2 Val grunngjevne i forsking og teori

<!-- criteria: 2.2 · the patterns cite the research basis of spec 04 §3; the References chapter lists it. -->

*Grunngje dei viktigaste vala dine med forsking og teori. Mønstra du har brukt, viser til forsking som du kan
byggje vidare på. Du finn ho under Referansar.*

### 3.3 Undervisnings- og vurderingsformer og varierte læremiddel

<!-- criteria: 2.3 (the main home of the activities), 1.1, 1.3.
     WHY: 2.3 names "varierte læremidler", and ALU says the portfolio covers educational technology (paraphrase,
     hvl-pedagogisk-mappe-criteria.md §6). spec 04 §7: each activity's title, type, phase, course, outcomes,
     rationale, universal design status, link and anonymised aggregates.
     resultat_merknad says that results come later (S5) or that the figures are formative aggregates. -->

*Aktivitetane under er digitale læremiddel du har laga, åleine eller saman med andre, i HVL Interaktiv. Vel ut dei
som best viser korleis du utviklar og prøver ut undervisnings- og vurderingsformer.*

{{resultat_merknad}}

{{#aktivitetar}}

#### {{tittel}}

- **Innhaldstype:** {{innhaldstype}} ({{status}})
- **Fase:** {{fase}}
- **Emne:** {{emne}}
- **Læringsutbytte:** {{laeringsutbytte}}
- **Didaktisk grunngjeving:** {{grunngjeving}}
- {{uu_status}}
{{#uu_merknader}}
  - {{alvor}}: {{melding}} ({{uu_grunngjeving}})
{{/uu_merknader}}
- **Datoar:** laga {{oppretta}}, sist endra {{endra}}
- **Lenke:** {{lenke}}
- **Anonymiserte resultat (formative):** {{resultat}}

*Refleksjon: Kva lærte du av denne aktiviteten, og kva vil du endre neste gong?*

{{/aktivitetar}}

### 3.4 Formidling av kompetanse frå undervisningsarbeidet

<!-- criteria: 2.4 ("formidlar kompetanse frå arbeid med undervisning på ulike måtar"; the examples are the search
     tool's summary of the call: articles, conference talks, reports, internal forums). -->

*Korleis har du delt det du har lært om undervisning, til dømes i artiklar, på konferansar, i rapportar eller i
interne forum?*

## 4 Kollegial haldning og erfaringsdeling

<!-- criteria: main criterion 3 ("har en kollegial holdning og er en aktiv pedagogisk bidragsyter med fokus på deling
     av erfaringer knyttet til utdanningskvalitet"). -->

### 4.1 Deling og faglege fellesskap

<!-- criteria: 3.1 -->

*Korleis deler du erfaringar med leiinga, kollegaer, studentar eller andre? Korleis har det bidrege til faglege
fellesskap om kvalitet i undervisninga?*

### 4.2 Studieplanarbeid og utviklingsarbeid

<!-- criteria: 3.2 -->

*Har du teke initiativ til, stått sentralt i eller leidd studieplanarbeid, pedagogisk eller fagdidaktisk
utviklingsarbeid, studiekvalitetsarbeid eller utgreiingsarbeid? Korleis heng arbeidet saman med dei strategiske
planane til HVL?*

### 4.3 Grunngjeven plan for vidare utvikling

<!-- criteria: 3.3 (also 1.2) -->

*Kva vil du utvikle vidare i eiga undervisning og i fagmiljøet, og kvifor? Kva rolle ser du for deg som merittert
undervisar?*

{{del1_slutt}}

## Referansar

<!-- criteria: 2.2 · filled from the references of the patterns the chosen activities come from (spec 04 §3).
     Not counted in the Del 1 word limit (HVL FAQ, medium). -->

*HVL Interaktiv fyller inn referansane frå mønstra som aktivitetane dine byggjer på. Legg til dei du sjølv viser
til i Del 1.*

{{referansar}}

# Del 2 – Pedagogisk CV: innspel

<!-- HVL 2025: "Søker kan enten bruke egen CV eller malen «Pedagogisk CV»" (high). The headings of HVL's CV template
     were not retrieved, so this part lists only what HVL Interaktiv can document (verify). -->

*Du kan bruke malen «Pedagogisk CV» frå HVL eller din eigen CV. Lim inn det som passar frå lista under.*

## Utvikling av digitale læringsressursar

{{#aktivitetar}}
- {{tittel}} ({{innhaldstype}}, {{emne}}), laga {{oppretta}}
{{/aktivitetar}}

# Del 3 – Forslag til vedlegg

<!-- HVL 2025: "inntil 11 vedlegg", "Ett av vedleggene må være anbefalingsbrev fra leder", "Alle vedlegg skal være
     vist til i den pedagogiske mappen" (high); the CV and figures in the text do not count as attachments (webinar,
     medium); "Mal for Lederuttalelse … (obligatorisk)" (medium). Items 2 to 4 are HVL's 2025 examples of attachments:
     "dokumentasjon og eksempler på utvikling av læringsressurser", "en bearbeidet sammenstilling av og refleksjon
     over studentevalueringer og andre tilbakemeldinger" and "rapporter om utvikling av emner/program" (medium).
     The page counts the numbered items between the markers against the attachment limit. -->

*Du kan leggje ved inntil {{maks_vedlegg}} vedlegg. Eitt av dei må vere eit anbefalingsbrev frå leiaren din. Vis
til alle vedlegga i mappa. Den pedagogiske CV-en og figurar i teksten tel ikkje som vedlegg.*

{{vedlegg_start}}

1. **Anbefalingsbrev frå leiar.** Det er obligatorisk. Bruk malen «Lederuttalelse» frå HVL. HVL Interaktiv lagar
   ikkje dette vedlegget.
2. **Dokumentasjon og døme på utvikling av læringsressursar**, til dømes desse aktivitetane:
{{#aktivitetar}}
   - {{tittel}}
{{/aktivitetar}}
3. **Samanstilling av og refleksjon over tilbakemeldingar frå studentar.** Tal frå HVL Interaktiv er anonymiserte
   og gjeld grupper med minst {{k}} studentar.
4. **Rapport om utvikling av emne eller studieprogram.**

{{vedlegg_slutt}}
