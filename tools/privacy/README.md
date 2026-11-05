# tools/privacy

## Purpose

Keeps the [data inventory](../../docs/privacy/DATA-INVENTORY.md) honest (`DATA-001`) and guards the
pseudonymisation rule for learner tables (`DATA-002`). `checkInventory.mjs` reads the Prisma schema
(`apps/server/prisma/schema/*.prisma`) and fails when:

- a model or stored field is missing from the inventory, or a row lacks purpose, category, legal basis,
  retention or location;
- the inventory lists a model or field the schema no longer has;
- a learner table (`H5PUserData`, `XapiStatement`, `GradeSyncJob`, `Identity`) gains a column named like
  a name, e-mail, Feide ID, national ID number or raw LTI subject. The only allowed exception is
  `GradeSyncJob.ltiSubEncrypted`, which AGS needs.

`checkDpiaInput.mjs` keeps the [DPIA input](../../docs/privacy/DPIA-INPUT.md) in step with its sources
(`DATA-005`, the document check D-113 counts as its test). It fails when:

- one of the sections 1 to 13 is missing or out of order;
- §6 differs from [the Canvas developer key](../../docs/reference/canvas-lti13-developer-key.json): the privacy
  level, a scope, the tool-level custom fields, or a placement and its custom fields (a placement on one side only
  counts too). Change the key and §6 together, and only after the DPO's review;
- §12's residuals are not numbered R1…Rn without a gap, a row lacks one of its six cells, or the DPIA input or the
  data inventory cites a residual §12 does not list.

## How to run

```bash
npm run privacy:inventory-check
npm run privacy:dpia-check
npx vitest run tools/privacy
```

When you add a field to the schema, add a row to the model's section in the inventory in the same commit.
