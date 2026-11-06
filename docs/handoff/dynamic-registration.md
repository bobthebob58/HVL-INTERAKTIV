# Design note: LTI Dynamic Registration (`LTI-009`)

| | |
|---|---|
| **Status** | Not built (COULD). S6 writes this design only (spec 02 `LTI-009` as amended, D-101) |
| **Decisions to read first** | D-050 (ltijs on our router and storage), D-051 (platforms and deployments from `LTI_PLATFORMS`), D-052, D-056 (keys at rest), D-064 (the audit) |
| **Code to read first** | `apps/server/src/lti/LtiProviderFactory.ts`, `src/lti/platforms/syncLtiPlatforms.ts`, `src/lti/platforms/LtiDeploymentGuard.ts`, `src/lti/storage/PrismaLtiDatabaseManager.ts`; ltijs 7.0.7's `services/dynamic-registration/` |
| **Reference** | [docs/reference/canvas-platform-values.md](../reference/canvas-platform-values.md) (§1.1 the developer key, §6 Dynamic Registration defaults to `privacy_level` `anonymous`) |

## Why it is not just "turn it on"

With Dynamic Registration a Canvas administrator pastes one URL into *Developer Keys → + LTI Registration*; Canvas
opens it with `openid_configuration` and `registration_token` in the query, the tool reads Canvas's configuration and
posts its own registration, and Canvas creates the developer key. ltijs 7 has a service for this
(`ProviderOptions.dynamicRegistration`, `onDynamicRegistration`, `register(...)`), but four things in this server stand
in the way, and one is a security hole if handled naively:

1. **The start-up sync undoes it.** D-051 makes `LTI_PLATFORMS` the list of platforms: at every start, platforms that
   are not configured are deactivated and lose their deployments. A dynamically registered platform would stop working
   at the next restart.
2. **No deployment, no launch.** ltijs does not check deployment IDs; `LtiDeploymentGuard` does, from
   `LtiDeployment` rows that only the sync writes. A registered platform with no deployment row refuses every launch.
3. **Anyone could register a platform.** ltijs's default handler registers whatever `openid_configuration` URL it is
   given. ltijs 7.0.7 creates the platform inactive unless `autoActivate` is set, and `LtiDeploymentGuard` refuses a
   platform without deployment rows, so a stranger's registration does not launch at once. But anyone who finds the
   URL can still make platform rows (each with its own tool key pair) at will, the server fetches whatever
   configuration URL it is handed, and one careless activation, or `autoActivate: true`, would let a stranger's
   "platform" sign launches as an instructor and become an LTI author in this tool.
4. **The registration must ask for exactly what the JSON key asks for:** the three scopes, `privacy_level`
   `anonymous`, the three placements, `feide_login` on the Deep Linking placements only and `hvl_placement` on each
   (canvas-platform-values.md §1.1, §7; D-061, D-063).

## Recommended design

- **One-time registration codes.** A portal `admin` (Feide only; an LTI launch never grants `admin`) creates a code
  that expires within an hour and names the expected issuer. The registration URL carries it; without a valid,
  unused code the route answers a plain refusal page and registers nothing. The code is stored only as a hash.
- **An issuer allow-list.** The `openid_configuration` URL must be https, its issuer must be the one the code names,
  and it must be one of Instructure's (production, beta, test) or a configured self-hosted one. The configuration's
  endpoints are checked as `LTI_PLATFORMS`' are.
- **Our own handler.** Use `onDynamicRegistration` with our checks, then ltijs's `register(...)` with overrides for the
  scopes, placements, custom fields and privacy level, then ltijs's closing snippet (`org.imsglobal.lti.close`).
- **A platform source.** A column such as `LtiPlatform.source` (`config` or `dynamic`) and a sync that touches only
  `config` rows. A migration; the data inventory gains no personal data.
- **Inactive until approved.** A dynamic platform starts inactive. The admin activates it in the portal once Canvas
  shows the deployment ID, which is entered there (or arrives in Canvas's registration answer *(verify)*); the
  deployment guard then works unchanged.
- **Audited.** Creating a code, a registration, an activation and a refusal are audit events with a fixed reason code,
  and no personal data (D-064's rules).
- The JSON developer key stays the documented fallback.

Decide first, as an amendment to D-051 or a new decision: the platform source, the approval step, and whether
deployment IDs may come from the portal as well as from `LTI_PLATFORMS`.

## Tests it needs

- The mock Canvas gains an OpenID configuration and a registration endpoint (`tools/mock-platform`, with its own
  tests first).
- Integration tests: a registration without a code, with a used or expired code, for an issuer outside the list, and
  with an `openid_configuration` URL on another host are all refused and register nothing; a valid one registers an
  inactive platform with exactly the requested scopes and placements; it survives a restart's sync; a launch is refused
  until the admin activates it with a deployment, then accepted.
- A step in [canvas-acceptance.md](canvas-acceptance.md) for ALU's test Canvas, done by a Canvas administrator.
