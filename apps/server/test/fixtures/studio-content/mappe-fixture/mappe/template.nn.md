---
# Front matter is ignored by the loader; the limits live in the criteria files.
id: mappe-fixture
---

# Pedagogisk mappe

{{forfattar}} · {{dato}} · {{kriteriesett}}

> **Utkast frå HVL Interaktiv.** Tal frå studentane er samandrag for grupper med minst {{k}} studentar.

<!-- A note for editors with a value name in it, {{ikkje_ein_verdi}}, which the loader never sees. -->

## Lesarrettleiing

{{lesarrettleiing}}

{{del1_start}}

# Del 1 – Samanhengande framstilling

*Ordtal: {{ordtal_del1}} av {{ordgrense}}.*

## 1 Mitt utgangspunkt

*Skildra korleis du tenkjer om læring og læringsdesign.*

{{#emneoversikt}}
- **{{emnekode}}:** {{tal}} aktivitetar ({{fasar}})
{{/emneoversikt}}

Samarbeid: {{samarbeid_tal}} av {{aktivitetar_tal}} aktivitetar.

## 2 Varierte læremiddel

{{resultat_merknad}}

{{#aktivitetar}}

### {{tittel}}

- **Innhaldstype:** {{innhaldstype}} ({{status}})
- **Fase:** {{fase}}
- **Emne:** {{emne}}
- **Læringsutbytte:** {{laeringsutbytte}}
- **Didaktisk grunngjeving:** {{grunngjeving}}
- **Universell utforming:** {{uu_status}}
{{#uu_merknader}}
  - {{alvor}}: {{melding}} ({{uu_grunngjeving}})
{{/uu_merknader}}
- **Lenke:** {{lenke}}
- **Anonymisert resultat (formativt):** {{resultat}}
- **Tal:** {{deltakarar}}; {{fullforing}}; {{median_forsok}}; {{endring}}
- **Datoar:** {{oppretta}}, {{endra}}, {{publisert}}

{{/aktivitetar}}

## Referansar

{{referansar}}

{{del1_slutt}}

# Del 2 – Pedagogisk CV

{{#aktivitetar}}
- {{tittel}} ({{oppretta}})
{{/aktivitetar}}

# Del 3 – Forslag til vedlegg

Du kan leggje ved inntil {{maks_vedlegg}} vedlegg.

{{vedlegg_start}}

1. **Anbefalingsbrev frå leiar** (HVL Interaktiv lagar ikkje dette.)
2. **Dokumentasjon av læringsressursar:** {{#aktivitetar}}{{tittel}}; {{/aktivitetar}}
3. **Samanstilling av tilbakemeldingar** (minst {{k}} studentar per gruppe)

{{vedlegg_slutt}}
