<!--
  content/mappe/template.nb.md: the Bokmål template of the pedagogisk mappe export (spec 04 §7, MAPPE-002, D-094).

  DRAFT, not confirmed by ALU (open question Q17). Translated from template.nn.md, which is the reference: the sources
  of every HVL rule are in its notes and in docs/reference/hvl-pedagogisk-mappe-criteria.md.

  Keep the same markers, lists, values and headings as template.nn.md (content/mappe/README.md). Run
  `npm run content:check` after every change.

  PRIVACY (MAPPE-003): no learner identifiers, free-text answers or individual scores anywhere in this file.
  PEDAGOGY: H5P results are formative only (CLAUDE.md §1); the notice under the title must stay.
-->

# Pedagogisk mappe

{{forfattar}} · {{dato}}

> **Utkast fra HVL Interaktiv.** Dette er et utgangspunkt, ikke en ferdig mappe. Tekst i *kursiv* er veiledning
> som du bytter ut med din egen tekst. Tall fra studentene er anonymiserte sammendrag for grupper med minst {{k}}
> studenter. Resultater fra H5P-aktiviteter er formative og er ikke dokumentasjon av eksamensresultater.

*Kriteriene i denne mappen er fra kriteriesettet «{{kriteriesett}}». HVL reviderer kriteriene til hver utlysning.
Sjekk derfor kriteriene, ordgrensen og antallet vedlegg i utlysningen du søker på.*

## Leserveiledning: kriterier og dokumentasjon

*Tabellen viser hvor i mappen du svarer på hvert kriterium, og hvilke vedlegg som dokumenterer det. Fyll inn
vedleggene når du har valgt dem.*

{{lesarrettleiing}}

{{del1_start}}

# Del 1 – Sammenhengende fremstilling

*Ordtall for Del 1: {{ordtal_del1}} av {{ordgrense}} ord. Referansene teller ikke med i ordgrensen. Tallet gjelder
filen slik HVL Interaktiv laget den, med veiledningen i kursiv. Tell ordene på nytt når du har skrevet teksten din.*

## 1 Mitt syn på undervisning og læringsdesign

*Beskriv kort hvordan du tenker om studentenes læring. Hvordan bruker du modellen for læringsdesign ved HVL, med
kontekst, kunnskap og samskaping, når du planlegger emnene dine? Hvordan henger arbeidet før, i og etter samlingene
sammen? Hvilken forskning og teori bygger du på?*

## 2 Studentenes læringsprosess

### 2.1 Erfaring med undervisning og veiledning

*Hvilke emner og studentgrupper har du undervist og veiledet? Hvordan støtter praksisen din studentenes
læringsprosess?*

Aktivitetene i mappen per emne, med antallet aktiviteter og hvor mange det er i hver fase:

{{#emneoversikt}}
- **{{emnekode}}:** {{tal}} ({{fasar}})
{{/emneoversikt}}

### 2.2 Systematisk utvikling over tid

*Hva har du endret i undervisningen din over tid, og hvorfor? Vis gjerne til aktiviteter du har revidert. Under
hver aktivitet i kapittel 3.3 står det når du laget den, og når du sist endret den.*

### 2.3 Tilbakemeldinger fra studenter og kolleger

*Hvordan henter du inn tilbakemeldinger fra studenter og kolleger? Hva har du endret på grunn av dem? Sammendragene
fra aktivitetene i kapittel 3.3 kan være en del av dokumentasjonen.*

### 2.4 Samarbeid om å utvikle undervisningen

*Hvem har du samarbeidet med om å utvikle undervisningen, for eksempel studenter, kolleger eller ledelsen? Hvorfor
var samarbeidet viktig?*

Du har laget {{samarbeid_tal}} av de {{aktivitetar_tal}} aktivitetene i mappen sammen med medforfattere.

## 3 En vitenskapelig tilnærming til undervisning

### 3.1 Utforskende og systematisk utviklingsarbeid

*Beskriv et utviklingsarbeid der du prøvde ut noe nytt, samlet inn data og vurderte effekten. Hva var spørsmålet
ditt, hva gjorde du, og hva fant du ut?*

### 3.2 Valg begrunnet i forskning og teori

*Begrunn de viktigste valgene dine med forskning og teori. Mønstrene du har brukt, viser til forskning som du kan
bygge videre på. Du finner den under Referanser.*

### 3.3 Undervisnings- og vurderingsformer og varierte læremidler

*Aktivitetene under er digitale læremidler du har laget, alene eller sammen med andre, i HVL Interaktiv. Velg ut
de som best viser hvordan du utvikler og prøver ut undervisnings- og vurderingsformer.*

*Lenken til en aktivitet åpner den bare for dem som har lov til å se den: et utkast eller en privat aktivitet kan
bare du og medforfatterne åpne. Før du sender mappen, publiser aktivitetene du viser til, og velg «Alle med
Feide-innlogging» på fanen «Deling», så kan også vurderere utenfor HVL åpne dem. Vil du ikke dele en aktivitet slik,
legg ved skjermbilder i stedet.*

{{resultat_merknad}}

{{#aktivitetar}}

#### {{tittel}}

- **Innholdstype:** {{innhaldstype}} ({{status}})
- **Fase:** {{fase}}
- **Emne:** {{emne}}
- **Læringsutbytte:** {{laeringsutbytte}}
- **Didaktisk begrunnelse:** {{grunngjeving}}
- {{uu_status}}
{{#uu_merknader}}
  - {{alvor}}: {{melding}} ({{uu_grunngjeving}})
{{/uu_merknader}}
- **Datoer:** laget {{oppretta}}, sist endret {{endra}}
- **Lenke:** {{lenke}}
- **Anonymiserte resultater (formative):** {{resultat}}

*Refleksjon: Hva lærte du av denne aktiviteten, og hva vil du endre neste gang?*

{{/aktivitetar}}

### 3.4 Formidling av kompetanse fra undervisningsarbeidet

*Hvordan har du delt det du har lært om undervisning, for eksempel i artikler, på konferanser, i rapporter eller i
interne forum?*

## 4 Kollegial holdning og erfaringsdeling

### 4.1 Deling og faglige fellesskap

*Hvordan deler du erfaringer med ledelsen, kolleger, studenter eller andre? Hvordan har det bidratt til faglige
fellesskap om kvalitet i undervisningen?*

### 4.2 Studieplanarbeid og utviklingsarbeid

*Har du tatt initiativ til, stått sentralt i eller ledet studieplanarbeid, pedagogisk eller fagdidaktisk
utviklingsarbeid, studiekvalitetsarbeid eller utredningsarbeid? Hvordan henger arbeidet sammen med HVLs strategiske
planer?*

### 4.3 Begrunnet plan for videre utvikling

*Hva vil du utvikle videre i egen undervisning og i fagmiljøet, og hvorfor? Hvilken rolle ser du for deg som
merittert underviser?*

{{del1_slutt}}

## Referanser

*HVL Interaktiv fyller inn referansene fra mønstrene som aktivitetene dine bygger på. Legg til dem du selv viser
til i Del 1.*

{{referansar}}

# Del 2 – Pedagogisk CV: innspill

*Du kan bruke malen «Pedagogisk CV» fra HVL eller din egen CV. Lim inn det som passer fra listen under.*

## Utvikling av digitale læringsressurser

{{#aktivitetar}}
- {{tittel}} ({{innhaldstype}}, {{emne}}), laget {{oppretta}}
{{/aktivitetar}}

# Del 3 – Forslag til vedlegg

*Du kan legge ved inntil {{maks_vedlegg}} vedlegg. Ett av dem må være et anbefalingsbrev fra lederen din. Vis til
alle vedleggene i mappen. Den pedagogiske CV-en og figurer i teksten teller ikke som vedlegg.*

{{vedlegg_start}}

1. **Anbefalingsbrev fra leder.** Det er obligatorisk. Bruk HVLs mal «Lederuttalelse». HVL Interaktiv lager ikke
   dette vedlegget.
2. **Dokumentasjon og eksempler på utvikling av læringsressurser**, for eksempel disse aktivitetene:
{{#aktivitetar}}
   - {{tittel}}
{{/aktivitetar}}
3. **Sammenstilling av og refleksjon over tilbakemeldinger fra studenter.** Tall fra HVL Interaktiv er
   anonymiserte og gjelder grupper med minst {{k}} studenter.
4. **Rapport om utvikling av emner eller studieprogram.**

{{vedlegg_slutt}}
