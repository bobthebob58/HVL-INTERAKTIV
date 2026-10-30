---
# Front matter is ignored by the loader; the limits live in the criteria files.
id: mappe-fixture
---

# Pedagogisk mappe

{{forfattar}} · {{dato}} · {{kriteriesett}}

> **Utkast fra HVL Interaktiv.** Tall fra studentene er sammendrag for grupper med minst {{k}} studenter.

<!-- A note for editors with a value name in it, {{ikkje_ein_verdi}}, which the loader never sees. -->

## Leserveiledning

{{lesarrettleiing}}

{{del1_start}}

# Del 1 – Sammenhengende fremstilling

*Antall ord: {{ordtal_del1}} av {{ordgrense}}.*

## 1 Mitt utgangspunkt

*Beskriv hvordan du tenker om læring og læringsdesign.*

{{#emneoversikt}}
- **{{emnekode}}:** {{tal}} aktiviteter ({{fasar}})
{{/emneoversikt}}

Samarbeid: {{samarbeid_tal}} av {{aktivitetar_tal}} aktiviteter.

## 2 Varierte læremidler

{{resultat_merknad}}

{{#aktivitetar}}

### {{tittel}}

- **Innholdstype:** {{innhaldstype}} ({{status}})
- **Fase:** {{fase}}
- **Emne:** {{emne}}
- **Læringsutbytte:** {{laeringsutbytte}}
- **Didaktisk begrunnelse:** {{grunngjeving}}
- **Universell utforming:** {{uu_status}}
{{#uu_merknader}}
  - {{alvor}}: {{melding}} ({{uu_grunngjeving}})
{{/uu_merknader}}
- **Lenke:** {{lenke}}
- **Anonymisert resultat (formativt):** {{resultat}}
- **Tall:** {{deltakarar}}; {{fullforing}}; {{median_forsok}}; {{endring}}
- **Datoer:** {{oppretta}}, {{endra}}, {{publisert}}

{{/aktivitetar}}

## Referanser

{{referansar}}

{{del1_slutt}}

# Del 2 – Pedagogisk CV

{{#aktivitetar}}
- {{tittel}} ({{oppretta}})
{{/aktivitetar}}

# Del 3 – Forslag til vedlegg

Du kan legge ved inntil {{maks_vedlegg}} vedlegg.

{{vedlegg_start}}

1. **Anbefalingsbrev fra leder** (HVL Interaktiv lager ikke dette.)
2. **Dokumentasjon av læringsressurser:** {{#aktivitetar}}{{tittel}}; {{/aktivitetar}}
3. **Sammenstilling av tilbakemeldinger** (minst {{k}} studenter per gruppe)

{{vedlegg_slutt}}
