# Operations

What HVL operations need to run HVL Interaktiv: runbooks for the tasks the server leaves to people, and the
deployment checklist (`DATA-004`, `DATA-010`, `NFR-002`; D-109, D-110). Each document says which requirements and
decisions it serves, the exact commands, and how to check the result. Commands print counts, years and dates, never
personal data or secrets (`DATA-009`).

| Document | When | Requirements |
|---|---|---|
| [yearly-purge.md](yearly-purge.md) | Every year from 31 August: check the yearly purge, then destroy the ended year's pseudonym secret | `DATA-003`, `DATA-002`, `DATA-007` |
| [data-subject-requests.md](data-subject-requests.md) | When HVL's data protection officer passes on a learner's request for access or erasure | `DATA-008`, `DATA-007`, `DATA-002`, `DATA-009` |
| [database-roles.md](database-roles.md) | Once per database, and at every deployment's migrate step: the database roles, encrypted connections and where the data lives | `DATA-010`, `DATA-004`, `DATA-007` |

**Still to come (S6 step 6, D-110):** the deployment checklist. Until it is written, database-roles.md holds the
TLS and EEA settings. The checklist must also say that the reverse proxy's access log leaves out the query string
(a few routes accept `?ltik=`, which the server keeps out of its own log but cannot remove from the proxy's,
`NFR-006`), that the proxy passes its request ID as `X-Request-Id` (a UUID or 32 hexadecimal digits, D-109's
amendment) so the two logs can be matched, and that no AWS config file is mounted into the server's container
(D-109's amendment of 2026-11-05; the server ignores one, and refuses `AWS_ENDPOINT_URL_S3` and `AWS_ENDPOINT_URL`).
