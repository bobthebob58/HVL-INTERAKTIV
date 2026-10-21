# HVL visual identity — reference notes (stand-in for `hvl-designmanual-og-logo.zip`)

| | |
|---|---|
| **Compiled** | 2026-10-16 |
| **For** | `docs/reference/` item 1, spec 03 §2 (design tokens), `UD-001`, `UD-002`, `UD-004` |
| **Status** | Derived from public sources. **Not** the official manual or logo files. HVL (profil@hvl.no) must still supply or confirm them. |
| **Logo artwork** | Deliberately not included or embedded here. |

## 0. Summary

1. HVL's only published design manual we could locate is **"Visuell identitet / Profilmanual"**,
   version 2.0, February 2017, developed by Burson-Marsteller. It is linked from the press-room page
   *Logo, design og grafiske element*. No newer manual was found.
2. The two **logo colours** are **Sjøgrønn PMS 7710 U = `#00AFBA`** (the symbol) and **Mørk blå 2
   PMS 3035 U = `#004357`** (the name). These values appear in an extract of the manual, in a
   third-party Quarto theme that transcribes the manual, in two unrelated public SVG copies of the
   logo, and in Brandfetch's scrape of hvl.no.
3. **None of the spec 03 brand tokens (`#003D4C`, `#005F6B`, `#007681`, `#F4F6F7`, `#111111`) and
   none of the plan's orange (`#FF9E1B`) were found in any HVL source.** The names "deep fjord teal"
   and "coastal teal" were not found in any HVL source either. `#003D4C` is close to the official
   `#004357`, but it is not the same colour.
4. HVL's typefaces are **NB Akademie Std** (titles, ingresses, captions) and **Lyon Text** (body).
   **Arial** (titles) and **Georgia** (body) are the Office substitutes. Spec 03 uses Inter and
   Calibri, and neither is named in the manual.
5. **Logo rules:** HVL publishes Norwegian (Nynorsk name) and English versions, each positive
   and negative (white), plus black and square versions. The logo must not be altered, and its
   name may change soon (see §6.4).

## 1. Method and provenance

- The container's proxy blocks every hvl.no host (`www.hvl.no`, `hvl.no`, `mediearkivet.hvl.no`,
  `home.hvl.no`). On 2026-10-16, `curl` returned `CONNECT tunnel failed, response 403` for each of them.
  We therefore **could not open the manual PDF or the logo page directly.**
- Values come from three independent kinds of source:
  - **S-A:** the WebSearch tool's extracts of the manual PDF and the hvl.no pages. The search
    engine read these sources; we did not. Quotes in this kind are copied from search-result text
    and may be truncated or paraphrased.
  - **S-B:** public GitHub repositories that transcribe the manual or embed HVL's logo. We cloned
    them read-only and never executed them, and we cite them by commit and line.
  - **S-C:** a brand-asset aggregator (Brandfetch).
- **Confidence:** *high* means S-A and S-B agree. *Medium* means only one credible source. *Low*
  means inferred.

### Sources

| ID | Source | Kind | Notes |
|---|---|---|---|
| S1 | https://www.hvl.no/siteassets/hvl-internett/dokument/trykksak/hvl_designmanual_2017.pdf | S-A (primary, read via search extracts) | "1 Visuell identitet / Profilmanual". Extracts: "Utviklet av Burson-Marsteller. Februar 2017. Versjon 2.0". Table of contents: *Typografi* p. 14, *Fargepalett* p. 16 |
| S2 | https://www.hvl.no/om/presserom/design-og-logo/ | S-A (primary, read via search extracts) | Page title "Logo, design og grafiske element – Høgskulen på Vestlandet" |
| S3 | https://mediearkivet.hvl.no/fotoweb/archives/5006-Pressebilder/AlleFiler/2019/10/25/02626.pdf.info (Norwegian logo), …/02627.pdf.info (English logo), …/2019/10/28/02629.png.info (negative logo) | S-A (primary, metadata only) | Usage note and licence string |
| S4 | https://www.hvl.no/student/eksamen/poster-og-plakat/ | S-A | Public poster templates |
| S5 | https://www.hvl.no/alu/universell-utforming/guide-powerpoint/ and https://www.hvl.no/alu/universell-utforming/guide-word/ | S-A | Refer staff to templates at hvl.no/malar (employees only) |
| S6 | github.com/julienvollering/quarto-hvl @ `23bc8f80c69f721aebf7f1bd528e77616d26b850` (2026-08-12) | S-B (secondary) | `HVLStyleGuideDictionary.R` ("Based on … Design Manual 2017") and `_extensions/hvl-brand/brand.yml` ("Encodes Visuell identitet / Profilmanual 2017"). The repository has no LICENSE file. Because it has no licence, its files are **not** copied into this repository; cite it by commit and line |
| S7 | github.com/SDGforskning/find-sdg-research @ `d7400e7f3a164fd9b5ec8d5b7963b73624f798a5` | S-B (logo embed) | `src/components/logos/HVLLeftNorLogo.tsx:15-16` (`<title>Høgskulen på Vestlandet`, `fill:#00afba`, `fill:#004357`); `HVLLeftEngLogo.tsx:15,19,26` |
| S8 | github.com/uib-ub/uib-ub-monorepo @ `f6ed18faa7ab1a9f38e01a36fa0b1a8c4815e3bf` | S-B (logo embed) | `packages/assets/src/assets/hvl-en.svg:8` `#00AFBA`, `:12` `#004357`; `hvl-icon.svg:5-6` `#00b6c9` |
| S9 | https://brandfetch.com/hvl.no | S-C | Lists the brand colours "Sherpa Blue (#004357), Burnt Sienna (#eb6851) and Pacific Blue (#00afba)". These are Brandfetch's colour names, not HVL's |
| S10 | https://www.hvl.no/om/universitetsprosjektet/, https://www.khrono.no/dette-er-nytt-for-hogskoler-og-universiteter-i-2026/1027289 | S-A | Name change pending (see §6.4) |

## 2. Where HVL publishes its identity

| What | URL | Facts (source, confidence) |
|---|---|---|
| Design manual and logo page | https://www.hvl.no/om/presserom/design-og-logo/ | "Vår designmanual gir føringar for bruk av vår logo, fargar, typografi og trykk." The page offers low-resolution and vector logos: *Hovedlogo (norsk, engelsk)* and *Hovedlogo negativ (norsk, engelsk)*. (S2, medium: search extract) |
| Design manual PDF | https://www.hvl.no/siteassets/hvl-internett/dokument/trykksak/hvl_designmanual_2017.pdf | Version 2.0, February 2017. No newer edition was found in any search. (S1, medium) |
| Press room | https://www.hvl.no/om/presserom/ | "Finn vår logo og designmanual." (S-A, medium) |
| Media archive (logo files) | mediearkivet.hvl.no (see S3) | "Logo til fri bruk, må brukes uendret. Ved spørsmål om bruk av logo og visuell profil kontakt profil@hvl.no" (S3, medium) |
| Office templates (*malar*) | hvl.no/malar | The universal-design guides point staff to it. It is described as **available to employees only**. We could not confirm the name "Vestibylen" from any source. (S5, medium) |
| Public poster templates | https://www.hvl.no/student/eksamen/poster-og-plakat/ | A0/A1/A4 PowerPoint templates. "Om du vil at posteren din skal ha engelsk logo, må du legge til eit nytt lysbilde av typen «HVL mørk ENG» eller «HVL lys ENG»." (S4, medium) |
| Contact | profil@hvl.no | Questions about logo use and the visual profile. (S3, medium) |
| Design service | https://www.hvl.no/alu/medielab/vi-hjelper-deg/ | Medielab is described as the main provider of design services for HVL. (S-A, low/medium: paraphrase only) |

## 3. Official colour palette (Fargepalett, manual p. 16)

Manual extract (S1): "Logoens farger er sjøgrønn PMS 7710 på symbolet og mørkblå PMS 3035 på
navnetrekket." The manual says the colour specifications are on page 16. It describes the
signalfargar (signal colours) as profiling colours, used in smaller amounts together with the
støttefargar (support colours) and tilleggsfargar (additional colours). It says the support colours
"complement the signal colours" and encourages active use of white ("bruke kvitt aktivt").

Values are given as printed. The Norwegian names and grouping follow S6 (`HVLStyleGuideDictionary.R:69-213`).
**Contrast** was computed by `tools/contrast.py` (WCAG 2.x relative luminance, run with `python3 -I`).

| Name (nn/nb as in source) | Group | PMS | CMYK | RGB | HEX (printed) | vs `#FFFFFF` | vs `#111111` | Text on white? | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| Sjøgrønn | Signalfarge (logo symbol) | PMS 7710 U | 81/0/23/0 | 0/175/186 | `#00AFBA` | 2.68 : 1 | 7.05 : 1 | No (decorative only) | high (S1, S6, S7, S8, S9) |
| Grønn | Signalfarge | PMS 2267 U | 32/0/42/0 | 151/223/154 | `#96DE99` ¹ | 1.59 : 1 | 11.87 : 1 | No | medium (S6 only) |
| Lys blå | Signalfarge | PMS 3105 U | 44/0/11/0 | 100/208/223 | `#64D0DF` | 1.81 : 1 | 10.46 : 1 | No | medium (S6 only) |
| Gul | Signalfarge | PMS 114 U | 0/4/87/0 | 249/222/69 | `#F9DE45` | 1.35 : 1 | 13.99 : 1 | No | high (S1, S6) |
| Oransje | Signalfarge | PMS 7416 U | 0/72/70/0 | 235/104/82 | `#EB6851` ¹ | 3.17 : 1 | 5.96 : 1 | Large text / non-text only | high (S1, S6, S9) |
| Mørk blå 1 | Støttefarge | PMS 7704 U | 93/4/8/24 | 0/138/175 | `#008AAF` | 4.00 : 1 | 4.72 : 1 | Large text / non-text only | high (S1 gives CMYK and RGB, S6 adds the hex) |
| Mørk blågrønn | Støttefarge | PMS 3285 U | 98/0/59/0 | 0/148/130 | `#009382` ¹ | 3.82 : 1 | 4.94 : 1 | Large text / non-text only | high (S1, S6) |
| **Mørk blå 2** | Støttefarge (logo name) | PMS 3035 U | 100/30/19/76 | 0/67/87 | `#004357` | **10.82 : 1** | 1.74 : 1 | **Yes, AAA** | high (S1, S6, S7, S8, S9) |
| Mørk rød | Støttefarge | PMS 7421 U | 18/100/45/67 | 109/36/57 | `#6D2439` | **10.71 : 1** | 1.76 : 1 | **Yes, AAA** | high (S1, S6) |
| Hvit | Tilleggstone | — | 0/0/0/0 | 255/255/255 | `#FFFFFF` | 1.00 : 1 | 18.88 : 1 | — | high (S1, S6) |
| Grå mørk | Tilleggstone | PMS 2332 U | 50/42/44/6 | 143/138/131 | `#8F8A83` | 3.43 : 1 | 5.51 : 1 | Large text / non-text only | high (S1, S6) |
| Grå medium | Tilleggstone | PMS 2331 U | 32/26/29/3 | 176/172/165 | `#B0ACA5` | 2.26 : 1 | 8.35 : 1 | No | high (S1, S6) |
| Grå lys | Tilleggstone | PMS 434 U | 5/6/8/10 | 210/205/200 | `#D2CDC8` | 1.58 : 1 | 11.97 : 1 | No | high (S1, S6) |
| Blågrå mørk | Tilleggstone | PMS 444 U | 45/16/25/50 | 112/124/124 | `#707B7B` ¹ | 4.37 : 1 | 4.32 : 1 | Large text / non-text only (just under 4.5) | high (S1, S6) |
| Blågrå medium | Tilleggstone | PMS 442 U | 25/7/19/20 | 172/183/178 | `#ACB7B2` | 2.06 : 1 | 9.15 : 1 | No | high (S1, S6) |
| Blågrå lys | Tilleggstone | PMS 5455 U | 17/4/6/4 | 201/213/218 | `#C9D5DA` | 1.50 : 1 | 12.60 : 1 | No | high (S1, S6) |

¹ **The printed HEX does not exactly match the printed RGB.** S1 extracts and S6 agree on these values,
so the mismatch is probably in the manual itself. The RGB-derived values are:
`#97DF9A` (2267 U), `#EB6852` (7416 U), `#009482` (3285 U) and `#707C7C` (444 U). The contrast
differences are negligible: for example, against white, `#009382` gives 3.82 : 1 and `#009482` gives
3.78 : 1. Use the printed HEX until HVL confirms the value.

**How certain the grouping is:** the columns follow S6, rated medium. One search extract put the five grey and blue-grey
tones under *støttefarger*, and another said the extract was "uklar på kva som er støttefarger og kva
som er signalfarger". Confirm the grouping on page 16 of the manual. It does not change any value.

**Logo-file fills differ from the manual in some copies.** S7 and S8 (`hvl-en.svg`) fill the logo
with `#00AFBA` and `#004357`, which match the manual. Other public copies use `#00B6C9` for the
symbol (S8 `hvl-icon.svg:5-6`, and the Inkscape-made `HVL-nobackground.svg` in S6) and `#003146` for
the name. We do not know where these copies came from. When HVL supplies the official SVGs, check
their fills against the table above.

**Colours on dark surfaces.** On `#004357`, these pass:

| Foreground on `#004357` | Contrast | Allowed use |
|---|---|---|
| `#FFFFFF` | 10.82 : 1 | AAA |
| `#F9DE45` | 8.02 : 1 | AAA |
| `#96DE99` | 6.81 : 1 | AA |
| `#64D0DF` | 5.99 : 1 | AA |
| `#00AFBA` | 4.04 : 1 | Large text and non-text only |

## 4. Are the spec 03 §2 tokens HVL colours?

| Spec token | Value | Plan's name | Found in an HVL source? | Nearest official colour | Contrast vs `#FFFFFF` / `#111111` / `#F4F6F7` |
|---|---|---|---|---|---|
| `--hvl-primary-dark` | `#003D4C` | "deep fjord teal" | **Not found in any HVL source** | Mørk blå 2 `#004357` (PMS 3035 U) | 11.85 / 1.59 / 10.93 |
| `--hvl-primary-accent` | `#005F6B` | "coastal teal" | **Not found in any HVL source** | None; the nearest are Mørk blå 1 `#008AAF` and Mørk blågrønn `#009382`, both lighter | 7.37 / 2.56 / 6.80 |
| `--hvl-primary-accent-light` | `#007681` | "coastal teal" | **Not found in any HVL source** | Mørk blå 1 `#008AAF` (closest role) | 5.37 / 3.51 / 4.96 |
| `--hvl-surface-warm` | `#F4F6F7` | — | **Not found in any HVL source** | Hvit `#FFFFFF`; Blågrå lys `#C9D5DA` | 1.08 / 17.42 / 1.00 |
| `--hvl-ink` | `#111111` | — | **Not found in any HVL source.** The palette has no black or near-black text colour | Mørk blå 2 `#004357` (a third-party theme uses it for body text, S6 `brand.yml:22`) | 18.88 / 1.00 / 17.42 |
| `--hvl-ink-muted` | `#4A5560` | — | **Not found in any HVL source** | Blågrå mørk `#707B7B` fails body text (4.37 : 1) | 7.61 / 2.48 / 7.02 |
| D-007 focus orange | `#FF9E1B` | — | **Not found in any HVL source.** HVL's orange is Oransje `#EB6851` (PMS 7416 U) | `#EB6851` | 2.07 / 9.13 / 1.91 |

The searches for the hex strings together with "HVL" or "Høgskulen på Vestlandet" returned nothing.
The search engine may ignore quoted hex strings, so this is evidence of absence only within the sources above.

## 5. Typography (manual p. 14)

| Role | Profile font, for designers (S1, S6 `HVLStyleGuideDictionary.R:9-46`) | Office font, for general staff (S1, S6 `:48-67`) | Confidence |
|---|---|---|---|
| Titles, subtitles, ingresses | **NB Akademie Std** (Bold for titles and subheadings, Regular for ingresses; the wordmark is set in NB Akademie Std Medium) | **Arial** | high |
| Body text | **Lyon Text**, "chosen for optimal legibility in body text" | **Georgia**, "chosen for optimal legibility where there are larger amounts of text" | high |
| Captions, graphs, footnotes, infographics, fact boxes | **NB Akademie Std Light** | **Arial** | high |

- The manual explains that Arial and Georgia were chosen because they are on every machine and in
  Microsoft Office, and because they match the profile fonts well (S1 extract, medium).
- **Licensing:** NB Akademie Std and Lyon Text are commercial typefaces. S6 `README.md:177` calls them
  "the licensed originals". Lyon is sold by Commercial Type (https://www.typewolf.com/lyon-text,
  https://type.today/en/journal/lyon; medium). We did not find whether HVL holds **web-font**
  licences for either typeface. No source confirmed NB Akademie's foundry or its licence terms.
- **Calibri** is not named in the manual. HVL's student assignment guidelines allow Times New Roman,
  Arial or Calibri, but that is a different context (S-A, medium). **Inter** is not mentioned in any
  HVL source.
- A third-party open-source approximation (S6) uses DM Sans for NB Akademie and Lora for Lyon Text.
  HVL has not endorsed this.

## 6. Logo variants and usage rules

### 6.1 Variants

| Variant | Facts | Source, confidence |
|---|---|---|
| Main logo, Norwegian | It carries the Nynorsk name "Høgskulen på Vestlandet". A symbol, built on a triangle and a V shape, sits next to the name (*navnetrekk*) | S1, S2, S7 `HVLLeftNorLogo.tsx:15`; medium |
| Main logo, English | "Western Norway University of Applied Sciences". "I kommunikasjon med internasjonale målgrupper skal den engelske versjonen [benyttes]" | S1, S2, S3 (02627); medium |
| Negative (white) | "Negativ (hvit) logo brukes der bakgrunnen er mørk." Available in Norwegian and English | S1, S2, S3 (02629); medium |
| Black | "Det er i tillegg laget en sort versjon som kan benyttes der fargeversjonen ikke er …" (extract truncated) | S1; medium |
| Square | "Den kvadratiske versjonen av logo finnes i positiv og negativ versjon. I noen sammenhenger kan det av plassmessige årsaker være vanskelig å bruke original logo med navnetrekk. Dette er særlig på kvadratiske formater. Da kan den kvadratiske versjonen benyttes." | S1; medium |
| Formats on the logo page | Low resolution and vector, for both the main and the negative logo, in Norwegian and English | S2; medium |

There is **no separate Bokmål logo.** HVL's official Norwegian name is in Nynorsk. One third-party
theme (S6 `README.md:171`) labels the Norwegian logo "Bokmål", but that label is wrong. Use the
Norwegian logo for both the `nn` and `nb` UI locales and the English logo for `en` (low: inferred
from the logo text and the absence of any Bokmål variant on S2).

### 6.2 Usage rules (manual extracts, S1; medium)

- "Logoens utseende, proporsjoner og farger må ikke endres. Det skal heller ikke tilføres elementer
  til logoen."
- "Man kan ikke endre avstanden mellom symbolet og navnet, eller avstanden mellom de enkelte
  bokstavene i navnet."
- The logo may be placed on profile colours or on images, "men det er viktig å passe på at logoen
  står på en rolig flate uten støy."
- The logo should be used consistently so that the visual profile works.
- **Clear space (*frisone*) and minimum size: NOT FOUND.** The search extract lists millimetre
  values under the logo heading, but their labels are garbled. Ask HVL.

### 6.3 Licence and trademark

- Media archive usage note (S3, for 02626, 02627 and 02629): **"Logo til fri bruk, må brukes uendret."**
- The same archive entries carry the copyright string **"Høgskulen på Vestlandet \ CC BY-SA 4.0"** (S3; medium).
  This **conflicts** with "må brukes uendret", because CC BY-SA allows adaptation. Use the
  stricter reading: **use the logo only unaltered** and ask profil@hvl.no before any other use.
- **Trademark registration: NOT FOUND.** A search found no Patentstyret record for HVL's logo, but
  we did not query the Patentstyret database directly.
- Practical rules for HVL Interaktiv:
  - Do not recolour, crop, animate or restyle the logo. That includes CSS filters, theme tokens
    and `currentColor` fills. The SVG sanitiser (CVE-2025-7062 work) must not rewrite official logo files.
  - Store the logo as a configured asset that is **not** derived from tokens.

### 6.4 Pending name change (affects the logo)

HVL has applied to NOKUT for university status. The proposed name is **"Universitetet på
Vestlandet"**, short form *Univest*. The NOKUT board aimed to decide "i løpet av hausten 2026",
followed by a decision of the King in Council. No decision had been published in the sources found
up to 2026-10-16 (S10; medium). If university status is granted, the name and logo will change, so
the logo, institution name and colours must be configuration, not code.

## 7. Proposed changes to spec 03 §2

These require a `docs/DECISIONS.md` entry, for example "D-0xx · Brand tokens aligned with HVL
Profilmanual 2017". That entry also updates D-007 and the CLAUDE.md invariant, which currently
names `#003D4C`. All ratios below were computed with `tools/contrast.py`.

| Token | Current | Proposed | HVL name | Contrast | Role and rule |
|---|---|---|---|---|---|
| `--hvl-primary-dark` | `#003D4C` | **`#004357`** | Mørk blå 2, PMS 3035 U | 10.82 : 1 on `#FFFFFF`; 9.98 : 1 on `#F4F6F7`; white text on it 10.82 : 1 | Headings, navigation, primary buttons. AAA |
| `--hvl-link` (rename of `--hvl-primary-accent`) | `#005F6B` | **`#004357`** | Mørk blå 2 | 10.82 : 1 | No official mid-tone teal reaches 4.5 : 1 on white. Links stay underlined, so they do not rely on colour alone. If a second link colour is required, HVL must approve a derived shade (`SPEC-DEVIATION`) |
| `--hvl-accent` (replaces `--hvl-primary-accent-light`) | `#007681` | **`#008AAF`** | Mørk blå 1, PMS 7704 U | 4.00 : 1 on white; 3.69 : 1 on `#F4F6F7` | Non-text UI (≥ 3 : 1) and large text only, the same role as before. Never body text. The alternative is Mørk blågrønn `#009382` (3.82 / 3.52) |
| `--hvl-brand-sea-green` (new) | — | **`#00AFBA`** | Sjøgrønn, PMS 7710 U | 2.68 : 1 on white (fails); 4.04 : 1 on `#004357`; `#111111` text on it 7.05 : 1 | Decorative on light surfaces (rules, illustrations). Non-text accents on `#004357`. As a fill only with `#111111` text. Never a state or focus indicator on white |
| `--hvl-brand-orange` (new; documents D-007) | `#FF9E1B` (plan) | **`#EB6851`** | Oransje, PMS 7416 U | 3.17 : 1 on white; `#111111` text on it 5.96 : 1 | Decorative or badge fill only. D-007 should say that `#FF9E1B` is not an HVL colour |
| `--hvl-surface` | `#FFFFFF` | keep `#FFFFFF` | Hvit | — | The manual encourages active use of white |
| `--hvl-surface-warm` → `--hvl-surface-alt` | `#F4F6F7` | **`#C9D5DA`** for panels and bands, or keep `#F4F6F7` labelled as a non-brand neutral | Blågrå lys, PMS 5455 U | `#111111` on it 12.60 : 1; `#004357` on it 7.22 : 1 | If `#F4F6F7` is kept, record it as a neutral, not an HVL colour |
| `--hvl-ink` | `#111111` | keep, relabelled as a neutral (not an HVL colour) | — | 18.88 : 1 | The HVL palette has no near-black. `#004357` is the brand alternative for headings |
| `--hvl-ink-muted` | `#4A5560` | keep as a neutral; **do not** replace it with Blågrå mørk `#707B7B` (4.37 : 1) or Grå mørk `#8F8A83` (3.43 : 1) | — | 7.61 : 1 | Those grey tones fail 4.5 : 1 for body text |
| `--hvl-focus-outer` / `--hvl-focus-inner` | `#003D4C` / `#FFFFFF` | **`#004357`** / `#FFFFFF` | Mørk blå 2 / Hvit | Outer ring 10.82 : 1 on white | Update `UD-004`, D-007 and the CLAUDE.md invariant |
| Feedback tokens | `#0F5132`/`#D1E7DD`, `#842029`/`#F8D7DA`, `#055160`/`#CFF4FC` | keep (not brand colours). Optionally use `#6D2439` Mørk rød as `incorrect-fg` (8.02 : 1 on `#F8D7DA`) and `#004357` as `info-fg` (9.28 : 1 on `#CFF4FC`) | — | — | The icon and text prefix rule (`UD-003`) is unchanged |

Rename the colour names in the spec table as follows. Replace "deep fjord teal" and "coastal teal",
which are not HVL names, with the manual's names: *Mørk blå 2*, *Mørk blå 1*, *Sjøgrønn*.

**Typography (`UD-002`):** the current stack `Inter, Arial, Calibri, sans-serif` is not HVL's. Choose one option:

- **(A) Follow the manual with system fonts.** Use headings `Arial, sans-serif` and body
  `Georgia, serif`. No self-hosting is needed, so `DATA-011` is satisfied.
- **(B) Use the profile fonts.** Use headings `"NB Akademie Std", Arial, sans-serif` and body
  `"Lyon Text", Georgia, serif`, self-hosted. This option applies **only** if HVL confirms that it
  holds web-font licences for both.
- **(C) Keep Inter.** Record this as a `SPEC-DEVIATION` in DECISIONS.

Remove Calibri in every option, because the manual does not name it.

**Logo:** add a config entry with `logo.nn`, `logo.nb` (the same file as `nn`), `logo.en` and
negative variants. The entry also holds the institution name, because of the pending
*Universitetet på Vestlandet* rename. Require the official SVGs, exempt them from token linting and
from SVG rewriting, and treat them as unalterable.

## 8. Still needed from HVL (profil@hvl.no or Kommunikasjon/Medielab)

1. The current design manual PDF and official logo SVG and EPS files (Norwegian, English, negative,
   black, square), with their checksums, for `docs/reference/`.
2. Confirmation that the 2017 v2.0 manual is still in force, and that page 16 values are correct,
   including the four hex/RGB mismatches and the group assignment.
3. Clear-space (*frisone*) and minimum-size rules for screen use.
4. Whether HVL holds web-font licences for NB Akademie Std and Lyon Text, and whether we may self-host them.
5. Whether derived tints or shades (for example a darker accessible Sjøgrønn) are allowed for UI states.
6. Which of "må brukes uendret" and "CC BY-SA 4.0" governs logo use in third-party software.
7. Status of the *Universitetet på Vestlandet* name and logo change, and its timeline.
8. Access to hvl.no/malar (employee templates), if the template colours or fonts are needed.

## 9. Files

- `docs/reference/hvl-visual-identity.md`: this document.
- `docs/reference/tools/contrast.py`: the WCAG 2.x contrast calculator. Run it with `python3 -I docs/reference/tools/contrast.py`.
- `docs/reference/tools/contrast-output.md`: the output of that run on 2026-10-16.
- The third-party transcription (S6) is **not** copied here, because that repository has no licence.
  Re-read it at the cited commit.
