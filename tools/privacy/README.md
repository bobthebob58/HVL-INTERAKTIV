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

## How to run

```bash
npm run privacy:inventory-check
npx vitest run tools/privacy
```

When you add a field to the schema, add a row to the model's section in the inventory in the same commit.
