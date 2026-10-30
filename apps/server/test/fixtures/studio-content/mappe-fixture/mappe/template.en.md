---
# Front matter is ignored by the loader; the limits live in the criteria files.
id: mappe-fixture
---

# Teaching portfolio

{{forfattar}} · {{dato}} · {{kriteriesett}}

> **Draft from HVL Interaktiv.** Student figures are summaries for groups of at least {{k}} students.

<!-- A note for editors with a value name in it, {{ikkje_ein_verdi}}, which the loader never sees. -->

## Reader's guide

{{lesarrettleiing}}

{{del1_start}}

# Part 1 – Continuous account

*Word count: {{ordtal_del1}} of {{ordgrense}}.*

## 1 My starting point

*Describe how you think about learning and learning design.*

{{#emneoversikt}}
- **{{emnekode}}:** {{tal}} activities ({{fasar}})
{{/emneoversikt}}

Collaboration: {{samarbeid_tal}} of {{aktivitetar_tal}} activities.

## 2 Varied learning materials

{{resultat_merknad}}

{{#aktivitetar}}

### {{tittel}}

- **Content type:** {{innhaldstype}} ({{status}})
- **Phase:** {{fase}}
- **Course:** {{emne}}
- **Learning outcomes:** {{laeringsutbytte}}
- **Didactic rationale:** {{grunngjeving}}
- **Universal design:** {{uu_status}}
{{#uu_merknader}}
  - {{alvor}}: {{melding}} ({{uu_grunngjeving}})
{{/uu_merknader}}
- **Link:** {{lenke}}
- **Anonymised result (formative):** {{resultat}}
- **Figures:** {{deltakarar}}; {{fullforing}}; {{median_forsok}}; {{endring}}
- **Dates:** {{oppretta}}, {{endra}}, {{publisert}}

{{/aktivitetar}}

## References

{{referansar}}

{{del1_slutt}}

# Part 2 – Teaching CV

{{#aktivitetar}}
- {{tittel}} ({{oppretta}})
{{/aktivitetar}}

# Part 3 – Suggested attachments

You may attach up to {{maks_vedlegg}} attachments.

{{vedlegg_start}}

1. **Letter of recommendation from your manager** (HVL Interaktiv does not make this.)
2. **Documentation of learning resources:** {{#aktivitetar}}{{tittel}}; {{/aktivitetar}}
3. **Summary of feedback** (at least {{k}} students per group)

{{vedlegg_slutt}}
