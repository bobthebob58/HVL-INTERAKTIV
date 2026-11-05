# Operations

What HVL operations need to run HVL Interaktiv: runbooks for the tasks the server leaves to people, and the
deployment checklist (`DATA-004`, `DATA-010`, `NFR-002`, `NFR-007`, `SEC-004`, `SEC-006`; D-109, D-110). Each
document says which requirements and decisions it serves, the exact commands, and how to check the result. Commands
print counts, years and dates, never personal data or secrets (`DATA-009`).

| Document | When | Requirements |
|---|---|---|
| [runbook.md](runbook.md) | Start here: what HVL IT provides, start and stop, configuration, key rotation, backups and the restore drill each semester, monitoring, incidents, the load test, and the deployment checklist | `NFR-002`, `NFR-001`, `NFR-006`, `NFR-007`, `DATA-004` |
| [yearly-purge.md](yearly-purge.md) | Every year from 31 August: check the yearly purge, then destroy the ended year's pseudonym secret | `DATA-003`, `DATA-002`, `DATA-007` |
| [data-subject-requests.md](data-subject-requests.md) | When HVL's data protection officer passes on a learner's request for access or erasure | `DATA-008`, `DATA-007`, `DATA-002`, `DATA-009` |
| [database-roles.md](database-roles.md) | Once per database, and at every deployment's migrate step: the database roles, encrypted connections and where the data lives | `DATA-010`, `DATA-004`, `DATA-007` |
| [docker.md](docker.md) | Building the server image, running the app stack (with its own clamd and the files origin) and its smoke test, here and in CI; what staging changes | `NFR-007`, `MAPPE-004`, `SEC-004`, `SEC-006`, `H5P-003` |
| [clamav.md](clamav.md) | Before upload scanning is turned on, and when clamd changes: the settings, clamd's own limits, signature updates and how to check that uploads are refused when they should be | `SEC-006`, `DATA-004`, `DATA-009`, `SEC-005` |

The deployment checklist is the last section of [runbook.md](runbook.md) (D-110's backup amendment of 2026-11-05):
with the TLS and EEA settings of database-roles.md, it also covers the reverse proxy's access log without the query
string, its `X-Request-Id`, plain bucket names and no mounted AWS config file (D-109's amendments), the files
origin's host name and certificate (`SEC-004`), and clamd (`SEC-006`; D-110's amendments).

Whether HVL IT should host the service at all, even for testing, is the subject of the IT assurance pack,
[docs/assurance/](../assurance/README.md) (D-116), which asks for it in stages. Its stage-1 request,
[test-environment.md](../assurance/test-environment.md), points back to these documents for the install steps.
