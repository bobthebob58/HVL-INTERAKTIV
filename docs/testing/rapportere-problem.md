# Melde frå om eit problem i HVL Interaktiv

Rettleiing for testarar i piloten. Ho fortel korleis du melder frå om eit problem, og kva som skjer etterpå.
Du kan skrive saka på nynorsk, bokmål eller engelsk.

> For utviklarar: etikettane og arbeidsgangen står på engelsk i [labels-and-triage.md](labels-and-triage.md).
> Avgjerda er D-101 i [DECISIONS.md](../DECISIONS.md) (tillegget frå 5. november 2026).

## Kort fortalt

1. Er det eit tryggleiksproblem? Då skal du ikkje opne ei sak. Meld frå privat, slik
   [SECURITY.md](../../SECURITY.md) seier.
2. Gå til [Issues → New issue](https://github.com/bobthebob58/HVL-INTERAKTIV/issues/new/choose) på GitHub.
3. Vel skjemaet «Feil» eller «Barriere for universell utforming».
4. Fyll ut skjemaet. Skriv ingen personopplysningar.
5. Send saka. Vi svarar i saka.

## Kva er ei sak?

Ei sak (på engelsk *issue*) er ei melding på GitHub. Saka får eit nummer. Vi skriv svar og spørsmål i saka, og
GitHub sender deg eit varsel når nokon svarar.

Koden til HVL Interaktiv er open. Difor kan **alle** lese sakene, også folk utanfor HVL.

Har du ikkje ein konto på GitHub? Gi same opplysningar til kontaktpersonen din i piloten. Kontaktpersonen opnar
saka for deg, utan namnet ditt.

Før du opnar ei ny sak:

- Søk i sakene. Har nokon alt meldt same problem? Skriv ein kommentar i den saka i staden.
- Skriv berre eitt problem i kvar sak. Har du funne to problem, opnar du to saker.

## 1. Vel rett skjema

| Skjema | Når du brukar det |
|---|---|
| **Feil** | Noko verkar ikkje slik det skal. Ein knapp gjer ingenting. Sida viser ei feilmelding. Eit svar blir ikkje lagra. |
| **Barriere for universell utforming** | Noko hindrar deg når du brukar tastatur, skjermlesar, forstørring eller anna hjelpemiddel. Eller noko er vanskeleg å sjå, høyre eller forstå. |
| Ikkje noko skjema | Du har funne eit tryggleiksproblem. Eller nokon kan sjå personopplysningar som dei ikkje skal sjå. Meld frå privat, slik [SECURITY.md](../../SECURITY.md) seier. |

Er du usikker? Vel «Feil». Vi endrar det om det trengst.

## 2. Ikkje skriv personopplysningar

Alle kan lese ei sak. Difor skal ei sak aldri ha personopplysningar. Skjemaet ber deg stadfeste dette før du
sender.

Skriv ikkje:

- namn på studentar eller kollegaer,
- e-postadresser,
- Feide-ID-ar (brukarnamnet som du loggar inn med i Feide),
- fødselsnummer eller studentnummer,
- svar som ein student har skrive,
- noko om helsa til nokon, også di eiga. Skriv kva hjelpemiddel du brukte, men ikkje kvifor du brukar det.

Vil du ikkje at andre skal sjå at du brukar hjelpemiddel? Då kan kontaktpersonen din opne saka for deg.

**Skjermbilete:** Dekk over eller skjer bort namn, e-post og profilbilete før du lastar opp biletet. Canvas viser
ofte namnet og biletet ditt, og namn på studentar i emnet. Bruk testbrukarar og testemne når du kan.

**Logglinjer:** Logglinjer frå tenaren til HVL Interaktiv kan du lime inn. Tenaren er laga slik at loggen ikkje har
personopplysningar (krav `DATA-009`).

- Lim ikkje inn loggar frå Canvas, frå Feide eller frå nettlesaren. Dei kan ha namn i seg.
- Ser du eit namn, ei e-postadresse eller ein Feide-ID i ei logglinje frå HVL Interaktiv? Då er det ein feil i
  personvernet. Lim ikkje inn linja. Meld frå privat, slik [SECURITY.md](../../SECURITY.md) seier.

**Skreiv du noko du ikkje skulle?** Rediger saka og fjern det med ein gong. Det er likevel ikkje nok. GitHub tek vare
på dei gamle versjonane av teksten, og eit bilete kan framleis opnast med lenkja si. Sei frå til kontaktpersonen din
så fort du kan. Har du ingen annan veg, skriv ein kort kommentar utan å gjenta opplysninga, til dømes «Ver snill og
slett ein gammal versjon av saka.» Vi slettar dei gamle versjonane og bileta.

## 3. Kva skal stå i saka?

Vi må kunne gjere det same som du gjorde, og sjå det same problemet. Difor spør skjemaet om dette:

| Felt i skjemaet | Kva du skriv | Døme |
|---|---|---|
| Kva gjorde du? | Stega, eitt steg på kvar linje. Start der du opna sida. | 1. Eg opna aktiviteten frå modulen i Canvas. 2. Eg valde svaret B. 3. Eg trykte på «Sjekk». |
| Kva venta du skulle skje? | Det du trudde skulle skje. | Eg venta at det sto om svaret var rett. |
| Kva skjedde i staden? | Det som faktisk skjedde. | Sida vart kvit. |
| Feilmelding | Teksten i feilmeldinga, nøyaktig, også ein feilkode. | «Noko gjekk gale» |
| Når skjedde det? | Dato og klokkeslett, så nøyaktig du kan. | 20.11.2026 kl. 14.05 |
| Kvar var du? | Sida eller fana. | «Canvas: Spel» |
| Kva for aktivitetstype? | Typen til aktiviteten. Typen står på startsida i portalen. | «Fleirval» |
| Skjermbilete | Eitt eller fleire bilete, utan personopplysningar. | |
| Kor alvorleg er det? | Sjå punkt 4. | |
| Eining | Datamaskin, nettbrett eller telefon, og operativsystemet. | PC med Windows 11 |
| Nettlesar og versjon | Namnet og versjonen. Versjonen står under «Om» i menyen til nettlesaren. | Firefox 144 |
| Hjelpemiddel og versjon | Skjermlesar, berre tastatur, forstørring eller talestyring. Skriv «ingen» om du ikkje brukte noko. | NVDA 2025.3 |
| Zoom og tekststorleik | Kor mykje du har zooma, eller kor stor teksten er. | 100 % |

Skjemaet for barrierar spør også om dette:

- **Kva høyrde eller såg du i staden?** Skriv det skjermlesaren las opp, ord for ord om du kan.
- **Kom du vidare på ein annan måte?** Skriv kva du gjorde, eller «nei».
- **WCAG-kriterium**, om du veit det. Det er ikkje noko krav.
- **Testprotokollen og resultatfila**, berre om du testa etter protokollen (sjå punkt 8).
- **Ny test:** Kryss av om du kan teste på nytt med same hjelpemiddel når barrieren er retta.

## 4. Kor alvorleg er det?

Vel det øvste nivået som passar.

| Nivå | Når | Døme |
|---|---|---|
| **1 – Kritisk** | Nokon kan ikkje bruke det i det heile, og det finst ingen annan veg. Eller det gjeld personvern eller tryggleik. | Aktiviteten opnar ikkje i Canvas. Ein som brukar skjermlesar, kjem ikkje forbi det første spørsmålet. Personvernsida seier noko anna enn det tenesta gjer. |
| **2 – UU-barriere** | Nokon blir hindra eller går glipp av informasjon, men kan halde fram. Det gjeld til dømes folk som brukar hjelpemiddel, ser dårleg eller ikkje høyrer lyd. | Skjermlesaren seier ikkje om svaret var rett. Du ser ikkje kvar fokus er. Videoen har ikkje teksting. |
| **3 – Kosmetisk** | Det ser feil ut, men alle kan bruke det. | Ein knapp står skeivt. Ein skrivefeil. |

UU står for universell utforming. Ein barriere som stengjer nokon heilt ute, er nivå 1.

Gjeld det personvern eller tryggleik, og kan nokon misbruke det? Då skal det ikkje vere ei sak. Meld frå privat.

## 5. Etikettar

Vi set etikettar (på engelsk *labels*) på saka. Dei viser kva slags sak det er, kor alvorleg ho er, og kor langt vi
har kome med å rette ho.

| Etikett | Kva han betyr |
|---|---|
| `type: feil` | Saka kom frå skjemaet «Feil». |
| `type: universell utforming` | Saka kom frå skjemaet «Barriere for universell utforming». |
| `alvor 1: kritisk` | Nivå 1. Vi rettar det først. |
| `alvor 2: UU-barriere` | Nivå 2. |
| `alvor 3: kosmetisk` | Nivå 3. |
| `treng vurdering` | Ny sak. Ingen har sett på ho enno. |
| `treng meir informasjon` | Vi har spurt deg om noko. Svar i saka. |
| `stadfesta` | Vi har fått fram problemet i testoppsettet. |
| `treng HVL-test` | Berre HVL kan sjå eller teste dette: i HVL sin Canvas, med Feide, på ei viss eining eller med ein skjermlesar. |
| `H5P oppstraums` | Årsaka er i koden til H5P, ikkje i koden vår (sjå punkt 7). |

Skjemaet set typen og `treng vurdering`. Den som går gjennom saka, set nivået du valde. Vi kan endre nivået. Då
skriv vi kvifor i saka.

## 6. Slik rettar vi eit problem

1. Vi les saka. Manglar det noko, spør vi deg i saka.
2. Vi prøver å få fram problemet i testoppsettet. Testoppsettet er ein kopi av tenesta med testdata, ein
   test-Canvas og ei test-innlogging. Vi brukar aldri ekte data om studentar.
3. Vi skriv ein test som feilar. Testen viser problemet.
4. Vi rettar årsaka, ikkje berre det du såg.
5. Vi køyrer testane for den delen av tenesta. Så køyrer vi alle kontrollane som må vere i orden før ei endring kan
   takast inn.
6. Endringa kjem på ei eiga grein (på engelsk *branch*) og blir eit endringsforslag (*pull request*). HVL les
   gjennom endringa, godkjenner ho og slår ho saman med hovudversjonen.
7. Vi lukkar saka og lenkjer til endringa. Når den nye versjonen er på testtenaren, kan du teste på nytt. Treng
   saka ein ny test hos HVL (sjå punkt 7), lukkar vi ho først etter den testen.

## 7. Når vi ikkje får fram problemet

### Berre i HVL sin Canvas eller med Feide

Nokre problem viser seg berre i Canvas hos HVL eller med ekte Feide-innlogging. Testoppsettet vårt har berre ein
test-Canvas og ei test-innlogging. Då treng vi:

- feilmeldinga, nøyaktig,
- dato og klokkeslett,
- logglinjene frå tenaren. HVL IT, som driftar tenaren, finn dei ut frå tidspunktet og sida, og limer dei inn i
  saka.

Vi set `treng HVL-test`.

### Berre på ei eining eller med skjermlesar

Nokre problem viser seg berre på éi eining, i éin nettlesar eller med éin skjermlesar. Då treng vi:

- nøyaktige steg, med tastane du brukte,
- kva skjermlesaren las opp, ord for ord,
- versjonen av eininga, nettlesaren og hjelpemiddelet.

Etter rettinga må HVL teste på nytt med same oppsett. Vi set `treng HVL-test`. Kryss av for «Ny test» i skjemaet
om du kan gjere det.

### Barrierar i koden til H5P

Aktivitetane er laga med H5P. Nokre barrierar ligg i koden til H5P, ikkje i koden vår. Vi endrar ikkje koden til H5P.
I staden gjer vi slik (avgjerd D-080):

- Kan vi reparere barrieren utan å endre korleis aktiviteten verkar? Då reparerer vi han når sida blir vist.
- Elles fører vi barrieren i ei liste over kjende H5P-barrierar.
- I begge tilfella melder vi barrieren til H5P.

Vi set `H5P oppstraums`.

## 8. For deg som testar etter testprotokollen

HVL har ein protokoll for manuell testing med hjelpemiddel:
[manual-test-protocol.md](../accessibility/manual-test-protocol.md) (på engelsk).

- Skriv resultata i ei datert fil i [docs/accessibility/results/](../accessibility/results/README.md). Følg malen
  der.
- Meld kvar ny barriere i ei sak. Vel oppsettet i skjemaet (til dømes AT-1), og skriv namnet på resultatfila.
- Lenk til saka frå resultatfila. Etter testen kan du berre leggje til lenkjer i fila. Ein ny test blir ei ny fil.
- Skriv rolle og initialar i resultatfila, ikkje fullt namn.

## 9. Ord i denne rettleiinga

| Ord | Kva det betyr |
|---|---|
| sak (*issue*) | Ei melding på GitHub om eit problem. |
| etikett (*label*) | Eit merke på ei sak. |
| portalen | HVL Interaktiv utanfor Canvas, når du loggar inn med Feide. |
| testoppsett | Ein kopi av tenesta med testdata, der vi prøver å få fram problemet. |
| hjelpemiddel | Skjermlesar, tastatur, forstørring, talestyring og liknande. |
| logglinje | Ei linje som tenaren skriv kvar gong nokon opnar ei side eller sender noko. Ho viser tid, side og svar frå tenaren, men ingen personopplysningar. |
| grein (*branch*) og endringsforslag (*pull request*) | Ein eigen versjon av koden med éi endring. HVL les han og godkjenner han. |
| oppstraums | I koden til nokon andre, her H5P. |
