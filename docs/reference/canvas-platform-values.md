# Canvas LTI 1.3: platform values and developer key for HVL Interaktiv

| | |
|---|---|
| **Status** | Assembled from Instructure's public docs and source. Replace or confirm with the TeCopp export. |
| **Assembled** | 2026-10-21 |
| **Supports** | `AUTH-005`, `LTI-001`, `LTI-003`, `LTI-005`, `LTI-008`, `LTI-009`, `LTI-012`, `LTI-013` (spec 02); `DATA-002`, `DATA-005` (spec 05) |
| **Companion file** | `canvas-lti13-developer-key.json`, ready to paste into Canvas (*Developer Keys → + LTI Key → Paste JSON*) |

## 0. Sources and how to read the citations

| Tag | Source | Version / integrity |
|---|---|---|
| `C:` | `github.com/instructure/canvas-lms`, sparse clone at `/home/user/instructure/canvas-lms` | commit `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c` (2026-04-30). Docs read from the checkout. Source files read with `git show HEAD:<path>`, so their line numbers are the file at that commit. |
| `L:` | npm `ltijs@7.0.7`, the version pinned by spec 02 §1. Unpacked with `npm pack --ignore-scripts`; no code was run. | sha1 `aee2e3da2c77240026737091963986d554827315`, matches `dist.shasum`; sha512 matches `dist.integrity`; Apache-2.0; `engines.node >=24` |
| `W:` | Web search results, used only as corroboration | URLs given inline |

Confidence: **high** means the official doc and the source code agree, or two independent sources agree. **Medium** means one credible source (usually code with no doc statement). **Low** means inferred.

`www.hvl.no` and `*.instructure.com` cannot be reached from the build container. **Nothing in this file comes from HVL's or TeCopp's own Canvas.** HVL-specific values are in §10.

---

## 1. Platform-side values (what the tool must store)

| Value | Production (Instructure-hosted) | Beta | Test | Evidence | Conf. |
|---|---|---|---|---|---|
| **Issuer `iss`** | `https://canvas.instructure.com` | `https://canvas.beta.instructure.com` | `https://canvas.test.instructure.com` | C:`doc/api/lti_launch_overview.md:10-14`: "Instructure-hosted Canvas instances all use the following, regardless of the specific account domain(s)". Default `lti_iss` in C:`config/security.yml.example:8`. | high |
| **OIDC auth endpoint** | `https://sso.canvaslms.com/api/lti/authorize_redirect` | `https://sso.beta.canvaslms.com/api/lti/authorize_redirect` | `https://sso.test.canvaslms.com/api/lti/authorize_redirect` | C:`doc/api/lti_launch_overview.md:84-88`: "For cloud-hosted Canvas, regardless of the domain used by the client, the endpoint is always:" | high |
| **Platform JWKS** | `https://sso.canvaslms.com/api/lti/security/jwks` | `https://sso.beta.canvaslms.com/api/lti/security/jwks` | `https://sso.test.canvaslms.com/api/lti/security/jwks` | C:`doc/api/lti_dev_key_config.md:26-29`. The route is served by `Lti::KeyStorage`, C:`app/controllers/security_controller.rb:64-69`. | high |
| **Token endpoint** (client-credentials grant) | `https://sso.canvaslms.com/login/oauth2/token`, **or** `https://<institution-domain>/login/oauth2/token` | `https://<institution>.beta.instructure.com/login/oauth2/token` (documented form). `sso.beta.canvaslms.com/...` is inferred only. | `https://<institution>.test.instructure.com/login/oauth2/token` (documented form). `sso.test.canvaslms.com/...` is inferred only. | See §2. | prod high; beta/test `sso.*` low |
| **Client ID** (`aud` of launches) | Global ID of the developer key, e.g. `10000000000001` | same | same | `aud`/`azp` = `developer_key.global_id`, C:`lib/lti/messages/jwt_message.rb:110-111`. Example value from C:`doc/api/registration.md:249`. | high |
| **Deployment ID** | Shown after the key is deployed to an account or course | — | — | C:`doc/api/lti_dev_key_config.md:37` | high |
| **AGS / NRPS service URLs** | Delivered in launch claims, on the **institution domain** (`environment_specific_domain`), not on `sso.*` | — | — | C:`lib/lti/messages/jwt_message.rb:235-242` (lineitems), `:288-295` (NRPS), C:`lib/lti/messages/resource_link_request.rb:123-132` (lineitem) | high |
| **Platform Storage origin** | `https://sso.canvaslms.com`. The frame name comes in `lti_storage_target`. | `sso.beta…` | `sso.test…` | C:`doc/api/lti_launch_overview.md:129`. Tools using Platform Storage "are required to use the new domain": C:`doc/api/lti_dev_key_config.md:31`. | high |

Self-hosted Canvas would differ: the `iss` "must be updated to your Canvas instance's hostname" (C:`doc/api/lti_launch_overview.md:16`). HVL's Canvas is Instructure-hosted (W: <https://www.hvl.no/en/hvl-students/learning-management-system/>; medium). **TeCopp is unknown.** A web search for "TeCopp" found nothing public. If TeCopp is an Instructure *test* environment (`*.test.instructure.com`), use the **Test** column. If it is a separate production instance, use **Production**. *(verify with TeCopp)*

### 1.1 What the tool registers in Canvas (Developer Key UI, outside the JSON)

| Field | Value | Why |
|---|---|---|
| Redirect URIs | `https://interaktiv.hvl.no/lti/launch` | Canvas requires an *exact* match with the `redirect_uri` sent in step 2 (C:`doc/api/lti_launch_overview.md:94,101`). ltijs 7 sends `redirect_uri` = the `target_link_uri` with query and fragment removed (L:`services/launch/launch.service.js:245,255,308-318`). Every `target_link_uri` in the JSON is therefore `…/lti/launch`. |
| JSON | `canvas-lti13-developer-key.json` | The pasted JSON does not carry redirect URIs: `LtiConfiguration.from_internal_lti_configuration` deletes `redirect_uris`, C:`lib/schemas/lti_configuration.rb:76`. |

---

## 2. Token endpoint: checking spec `LTI-001`

Spec 02 `LTI-001` (now at `docs/specs/02-auth-feide-lti13.md:128-138`) says: token `https://sso.canvaslms.com/login/oauth2/token`.

**Verdict:** the value is **valid**, but the spec should say why, list the alternative, and record the `aud` rule. (High confidence: Canvas source and an independent vendor guide agree.)

Evidence:

1. **Public docs** show only the institution-domain form. The request is `POST /login/oauth2/token` (C:`doc/api/oauth_endpoints.md:110-115`), with the example assertion `"aud": "https://<canvas_domain>/login/oauth2/token"` (`:283`). The docs then add: "the value of the aud claim should contain either the domain of the Canvas account where the desired data resides, **or the domain of the LTI 1.3 OIDC Auth endpoint**" (`:294`).
2. **Canvas's own OpenID configuration** (served to Dynamic Registration) sets `token_endpoint: oauth2_token_url(host:)`, where `host = Lti::Oidc.auth_domain(...)` (C:`app/controllers/security_controller.rb:115,122`). `Lti::Oidc.auth_domain` explains: "Instructure-hosted Canvas overrides this method in MRA, since it uses … `canvas.instructure.com` for the iss, and `sso.canvaslms.com` for the OIDC Auth endpoint" (C:`lib/lti/oidc.rb:21-24`). Hosted Canvas therefore advertises `https://sso.canvaslms.com/login/oauth2/token`. This is inferred from the comment, because the MRA override is not open source.
3. **Assertion `aud` check:** the expected audience is `oauth2_token_url(host: <request host>)` plus the auth domain (C:`lib/canvas/oauth/client_credentials_provider.rb:26-29`, C:`lib/canvas/oauth/asymmetric_client_credentials_provider.rb:24`). The JWT is accepted if the arrays intersect (C:`lib/canvas/security/jwt_validator.rb:58-62`). Posting to `sso.canvaslms.com` with `aud = https://sso.canvaslms.com/login/oauth2/token` therefore matches.
4. **Using the token on the institution domain:** AGS and NRPS endpoints accept tokens whose `aud` is the token URL on the request host **or** on `canvas.instructure.com` or `sso.canvaslms.com`. These are `UNIVERSAL_GRANT_HOSTS`, with the comment "While we migrate over from using canvas.instructure.com as the universal host to sso.canvaslms.com" (C:`lib/lti/ims/advantage_access_token_request_helper.rb:32-36,63-71`).
5. **Independent corroboration:** Kaltura's Canvas guide moves `lti13AuthTokenUrl` from `canvas.instructure.com` to `https://sso.canvaslms.com/login/oauth2/token`. It also notes that installs using their own Canvas domain need no change (W: <https://kaltura.knowledgeowl.com/help/canvas-lti-13-change-july-2023>, <https://knowledge.kaltura.com/help/set-up-lms-integration-lti-1-3-in-canvas>).
6. **ltijs 7.0.7** POSTs to `platform.accessTokenEndpoint` and signs the assertion with `aud: platform.authorizationServer` (L:`services/access-token-manager/access-token-manager.service.js:54,63`). When `authorizationServer` is unset, it defaults to `accessTokenEndpoint` (L:`services/platform-manager/platform.serializer.js:23-27`). **Leave `authorizationServer` empty** (or set it to the same URL), and `aud` will match whichever token URL is used.

Recommendation: keep `https://sso.canvaslms.com/login/oauth2/token` for production. Record `https://hvl.instructure.com/login/oauth2/token` *(verify domain)* as the documented fallback. For a beta or test TeCopp, use the institution test/beta domain, which is the documented form, until `sso.test`/`sso.beta` token URLs are confirmed.

---

## 3. JSON configuration schema (manual "Paste JSON")

Validated by `Schemas::LtiConfiguration` (C:`lib/schemas/lti_configuration.rb:24-57`). Unknown keys are stripped, not rejected (C:`lib/schemas/base.rb:89-118`). The companion file therefore uses only schema keys and no `_comment` keys.

| Key | Req. | Notes | Cite |
|---|---|---|---|
| `title`, `description` | yes | `description` is shown only in `assignment_selection`, `link_selection`, `ActivityAssetProcessor` | C:`lib/schemas/lti_configuration.rb:27-32`; C:`lib/schemas/internal_lti_configuration.rb:123-124` |
| `oidc_initiation_url`, `target_link_uri` | yes | `target_link_uri` can be overridden per placement | C:`doc/api/lti_dev_key_config.md:191-224` |
| `oidc_initiation_urls` | no | Per-AWS-region overrides | C:`doc/api/lti_dev_key_config.md:203-211` |
| `public_jwk_url` **or** `public_jwk` | one of them | The JWK "**must** include an alg and use" | C:`doc/api/lti_dev_key_config.md:276-297`; C:`doc/api/oauth.md:308` |
| `scopes` | no | Enum, §4 | C:`doc/api/lti_dev_key_config.md:226-247`; C:`lib/schemas/internal_lti_configuration.rb:131` |
| `custom_fields` | no | Tool-level. Values are sent as strings. | C:`doc/api/lti_dev_key_config.md:298-307` |
| `extensions[].platform` | yes | `"canvas.instructure.com"` | C:`lib/schemas/lti_configuration.rb:39-41`; C:`doc/api/lti_dev_key_config.md:351` |
| `extensions[].domain` | no | Recommended with deep linking. Returned links are domain-matched. | C:`doc/api/lti_dev_key_config.md:333`; C:`doc/api/link_selection_placement.md:74-76` |
| `extensions[].tool_id` | no | Free identifier | C:`doc/api/lti_dev_key_config.md:342` |
| `extensions[].privacy_level` | doc: "Required" (schema: optional) | `anonymous`, `name_only`, `email_only`, `public` | C:`doc/api/lti_dev_key_config.md:355-367`; C:`lib/schemas/lti_configuration.rb:44` |
| `extensions[].settings.placements[]` | yes (settings) | `placement` (required, enum), `message_type`, `target_link_uri`, `custom_fields`, `text`, `labels`, `icon_url`, `selection_width/height`, `enabled`, `visibility` (`admins`/`members`/`public`), `required_permissions`. Placement-specific: `use_tray` (`editor_button`). | C:`lib/schemas/internal_lti_configuration.rb:135-204`; C:`doc/api/lti_dev_key_config.md:486-582,628-634` |

`message_type` must be allowed for the placement, otherwise the launch is stopped with `InvalidMessageTypeForPlacementError` (C:`lib/lti/lti_advantage_adapter.rb:198-205`).

---

## 4. Scopes

Allowed in the JSON (C:`doc/api/lti_dev_key_config.md:236-244`; constants in C:`lib/token_scopes.rb:41-46`):

| Scope URI | Used by HVL Interaktiv? |
|---|---|
| `https://purl.imsglobal.org/spec/lti-ags/scope/score` | **Yes**, `LTI-012`. ltijs `submitScore` requests only this scope when `scoreMaximum` is passed (L:`services/grading/grading.service.js:110-112`). |
| `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly` | **Yes**, `LTI-012`. Lets the worker tell a deleted line item (→ `orphaned`) from a transient error, and is the ltijs fallback when `scoreMaximum` is missing (same lines). It reads assignment metadata only, no personal data. Removable if not wanted. |
| `https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly` | **Yes**, `LTI-008` (L:`services/names-and-roles/names-and-roles.service.js:39`). Canvas adds the NRPS claim only when the key has this scope and the context is a course or group (C:`lib/lti/messages/jwt_message.rb:281-286`). |
| `…/lti-ags/scope/lineitem` (write) | No. `LTI-005` creates line items via the Deep Linking `lineItem`, which needs no OAuth scope. |
| `…/lti-ags/scope/result.readonly` | No. It would read learners' results, which is not needed (data minimisation). |
| `…/lti/scope/noticehandlers`, `canvas…/public_jwk/scope/update` | No |

`LTI-005` (Deep Linking) needs no scope. However, Canvas includes the AGS claim in launches only if the key has **at least one** AGS scope (C:`lib/lti/messages/jwt_message.rb:216-220`). `score` covers that.

---

## 5. Placements that accept `LtiDeepLinkingRequest`

From `PLACEMENTS_BY_MESSAGE_TYPE` (C:`app/models/lti/resource_placement.rb:103-118`): `assignment_selection`, `ActivityAssetProcessor`, `ActivityAssetProcessorContribution`, `collaboration`, `conference_selection`, `course_assignments_menu`, **`editor_button`**, `homework_submission`, **`link_selection`**, `migration_selection`, `module_index_menu_modal`, `module_menu_modal`, `resource_selection`, `submission_type_selection`. Some are behind feature flags (C:`app/models/lti/resource_placement.rb:142-149`).

Deep-linking settings Canvas sends for the three chosen placements (C:`lib/lti/messages/deep_linking_request.rb:35-127`):

| Placement | `accept_multiple` | `accept_types` | `auto_create` | Grade sync? | Who sees it |
|---|---|---|---|---|---|
| `assignment_selection` (`:36-42`) | **false** | `ltiResourceLink` | false | **Yes.** A `lineItem` creates the assignment and sets its points and name (C:`doc/api/content_item.md:134-165`). | Users who can create assignments (C:`doc/api/assignment_selection_placement.md:47-48`) |
| `link_selection` (`:92-98`) | **true** in code. The doc says "Only one LTI resource can be returned at a time" (C:`doc/api/link_selection_placement.md:36`). | `ltiResourceLink` | false | **No** (C:`doc/api/link_selection_placement.md:37-41`). `lineItem` is ignored here (C:`doc/api/content_item.md:141-153`). | Users who can create module items (`:45`) |
| `editor_button` (`:78-84`) | true | `link file html ltiResourceLink image` | false | **No** (C:`doc/api/editor_button_placement.md:27-29`) | `visibility` defaults to `public`, which includes students in discussion posts. Set to `admins` (`:116-118`). |

Only `assignment_selection`, `course_assignments_menu` and `module_index_menu_modal` turn a `lineItem` into an assignment (C:`doc/api/content_item.md:141-153`). A gradebook `lineitem` claim reaches learners only when they launch a resource tied to one assignment (C:`lib/lti/messages/resource_link_request.rb:121-132`).

---

## 6. `privacy_level`: values and released claims

Values: `anonymous` (shown as **"Private"** in the Developer Key UI), `name_only`, `email_only`, `public` (C:`doc/lti/16_privacy_level.md:6-12`; enum C:`app/models/context_external_tool.rb:171-176,615-619`). Dynamic Registration defaults to `anonymous` (C:`doc/api/registration.md:171`).

| Claim (LTI 1.3) | anonymous | name_only | email_only | public | Code |
|---|---|---|---|---|---|
| `sub` (Canvas user `lti_id`) | ✓ | ✓ | ✓ | ✓ | always: C:`lib/lti/messages/jwt_message.rb:117,121-123`; doc: "the 'sub' claim … is always included" (C:`doc/api/lti_dev_key_config.md:361`) |
| `name`, `given_name`, `family_name`, `lis.person_sourcedid`, `lis.course_offering_sourcedid` | — | ✓ | — | ✓ | C:`jwt_message.rb:65,175-181`; `include_name?` = `name_only? \|\| public?` (C:`context_external_tool.rb:629-631`) |
| `email` | — | — | ✓ | ✓ | C:`jwt_message.rb:64,183-185`; `include_email?` (C:`context_external_tool.rb:625-627`) |
| `picture`, `role_scope_mentor` | — | — | — | ✓ | C:`jwt_message.rb:62-63,187-193` |
| roles, context, locale, platform, custom, AGS/NRPS endpoints, `lti11_legacy_user_id` (opaque) | ✓ | ✓ | ✓ | ✓ | C:`jwt_message.rb:66-77` |

NRPS member objects follow the same pattern: `email` (email_only/public); `name`, `given_name`, `family_name`, `lis_person_sourcedid` (name_only/public); `picture` (public) (C:`doc/lti/16_privacy_level.md:64-83`).

---

## 7. Custom variable substitutions and privacy

| Variable | Returns | Availability | Cite |
|---|---|---|---|
| `$Canvas.user.loginId` (= `$User.username`) | "Username/Login ID for the primary pseudonym for the user for the account. This may not be the pseudonym the user is actually logged in with." | "when pseudonym is in use" | C:`doc/api/tools_variable_substitutions.md:1146-1165`; C:`lib/lti/variable_expander.rb:1563-1566` (guard `PSEUDONYM_GUARD`, `:93`) |
| `$Canvas.user.sisSourceId` / `$Person.sourcedId` | SIS ID of the primary pseudonym | when pseudonym is in use | C:`doc/api/tools_variable_substitutions.md:1166-1195` |
| `$Canvas.user.id` / `$User.id` | Canvas numeric user ID | logged-in user | C:`doc/api/tools_variable_substitutions.md:988-1005` |

**Which privacy level does `$Canvas.user.loginId` need in LTI 1.3? None.** (Medium confidence: the code is clear, but no Instructure doc says so, and a web search found no statement either way. Confirm with one TeCopp launch.)

- LTI 1.3 custom fields are expanded by `@expander.expand_variables!` (C:`lib/lti/messages/jwt_message.rb:72,171-173,320-330` → C:`lib/lti/variable_expander.rb:148-165`). Expansion checks only the variable's guards (C:`lib/lti/variable_expansion.rb:37-49`). No privacy check appears on this path.
- By contrast, in **LTI 1.1** the built-in `custom_canvas_user_login_id` is sent only at `public` (C:`doc/lti/16_privacy_level.md:26-31`). Old guidance saying "loginId needs Public" applies to 1.1.
- **Consequence:** `privacy_level` does not limit what admins put in `custom_fields`. Any PII variable (`$Person.name.full`, `$Person.email.primary`, …) is released whatever the level. The DPIA must cover the custom fields too.
- If the guard fails, Canvas sends the literal string (`"$Canvas.user.loginId"`) (C:`lib/lti/variable_expansion.rb:40-41`; C:`doc/api/tools_variable_substitutions.md:17-20`). The tool must treat values starting with `$` as absent.
- **Scope of a placement-level custom field:** Canvas merges tool-level fields with that placement's fields only when the launch's `resource_type` is that placement (C:`app/models/context_external_tool.rb:1175-1190`). Placement launches set `resource_type: selection_type` (C:`app/controllers/external_tools_controller.rb:1211-1214`). Learner launches of module items and assignments pass no `resource_type` (C:`app/controllers/application_controller.rb:2495-2530`). They receive tool-level fields plus the resource link's own `custom` (C:`lib/lti/messages/resource_link_request.rb:89-92`). **A custom field put only on the deep-linking placements therefore never reaches a learner's resource-link launch.**

---

## 8. HVL choice: `privacy_level: "anonymous"`, and the trade-off with `AUTH-005`

Spec 05 says learners are pseudonyms; no names, e-mails or Feide IDs are stored (`DATA-002`), and teachers see aggregates only. `LTI-008` needs **counts** only. With `anonymous`, Canvas sends neither learner names and e-mails in launches nor in NRPS (§6). The tool still gets `sub` for `learnerKey` and AGS. **Choose `anonymous`.** `name_only`, `email_only` and `public` would release PII for **every** learner on every launch and in NRPS. That contradicts `DATA-002` and the `AUTH-004` principle, and ltijs would keep it in ID-token records for 24 h (`LTI-002`).

`AUTH-005` wants one personal library for a teacher whether they come through Canvas or Feide. The options:

| Option | What Canvas releases | Pros | Cons |
|---|---|---|---|
| **A (in the JSON):** `anonymous` + `feide_login = $Canvas.user.loginId` on the 3 deep-linking placements only; `editor_button` `visibility: admins` | Login ID of users who open the picker: teachers, designers, admins, TAs. Never in learner resource-link launches (§7). | Automatic linking. No extra click. | The value format at HVL is unknown: it may equal the Feide ID `user@hvl.no`, or not. It is the *primary* pseudonym, not necessarily the one used to log in. Student TAs are included. `visibility` hides the button but is not access control, so the server must still drop the claim unless `LTI-004` gives `author`. |
| **B:** `anonymous`, no custom field; one-time "Link with Feide" pop-up | Nothing | No Canvas PII at all | One extra Feide login per author. Needs a top-level pop-up from the iframe. |
| **C:** `name_only` / `public` | Names (and e-mail) of all users | — | Rejected: breaks spec 05 data minimisation. |

To switch from A to B, delete the three `custom_fields` objects from the JSON. Option A is safe only with the server rules proposed in §9 (`AUTH-005`).

---

## 9. Proposed corrections to spec 02 (and one to spec 05)

| Location (current line) | Proposal | Evidence |
|---|---|---|
| `LTI-001` (`:128-138`) | Keep the four production values but drop *(verify)* for the public ones. Add: (a) the token alternative `https://<institution-domain>/login/oauth2/token`; (b) the ltijs `authorizationServer` stays empty, so the assertion `aud` = token URL; (c) beta/test values (`canvas.{beta,test}.instructure.com`, `sso.{beta,test}.canvaslms.com`) used if TeCopp is a beta/test environment; (d) Platform Storage requires the `sso.canvaslms.com` auth endpoint; (e) platform identity is `(iss, client_id)`, because every hosted Canvas shares one `iss`. Keep *(verify)* only for `client_id`, deployment ID and TeCopp's environment. | §1, §2 |
| `LTI-003` (`:155`) | `CANVAS_ORIGINS` must include the TeCopp origin(s) as well as production. `frame-ancestors` lists institution domains, never `sso.canvaslms.com`; the storage frame is a sibling, not an ancestor. | C:`doc/api/lti_launch_overview.md:129` |
| `LTI-005` (`:169-178`) | Define "graded placements" as `assignment_selection` only (and `course_assignments_menu` / `module_index_menu_modal` if added later). Omit `lineItem` for `link_selection` and `editor_button`, because Canvas ignores it there. Note that `assignment_selection` sends `accept_multiple: false`. Keep returned links on `interaktiv.hvl.no`, because domain matching is enforced. | §5 |
| `LTI-008` (`:197-201`) | Requires scope `contextmembership.readonly`. With `anonymous`, NRPS members carry no names or e-mails. | §4, §6 |
| `LTI-009` (`:203-205`) | Fallback JSON = `docs/reference/canvas-lti13-developer-key.json` (this file). Redirect URI `…/lti/launch` is entered separately. | §1.1 |
| `LTI-012` (`:226-244`) | Scopes `score` (+ `lineitem.readonly`). Always pass `scoreMaximum: 100`, so ltijs needs only `score`. The AGS `lineitem` claim exists only for assignment-backed links. | §4, §5 |
| `LTI-013` (`:245`) | On `assignment_selection`, `lineItem.label` (or `title`) **becomes the Canvas assignment name** and overwrites the teacher's name. Decide whether "(formativ)" should appear there, or send `"https://canvas.instructure.com/lti/preserveExistingAssignmentName": true`. | C:`doc/api/content_item.md:155-165` |
| `AUTH-005` (`:118-122`) | Replace *(verify with TeCopp)* with these rules: the claim is configured **only** on deep-linking placements; it is not gated by `privacy_level` in 1.3; the server reads `custom.feide_login` only when `LTI-004` yields `author`, ignores values starting with `$`, and never stores it for learners; HVL's login-ID format must still be confirmed by TeCopp. | §7, §8 |
| §1 facts table (`:14-22`) | Add a row: "Canvas platform values (checked 2026-10-21)", linking `docs/reference/canvas-platform-values.md`. | — |
| spec 05 `DATA-005` | DPIA input must list Canvas `privacy_level = anonymous` **and** the developer key's custom fields, since custom fields can release PII at any privacy level. | §7 |

---

## 10. Still needed from HVL / TeCopp

1. Whether TeCopp is an Instructure *test* or *beta* environment or a separate production instance, plus its exact URL. This picks the column in §1.
2. HVL's production Canvas URL, assumed `hvl.instructure.com`; also any vanity domain. Needed for `CANVAS_ORIGINS` and the fallback token URL.
3. After pasting the JSON: the **client ID** (developer key global ID) and the **deployment ID** for each deployment.
4. One test launch from `link_selection` by a teacher, to confirm `custom.feide_login` and its format. If it does not equal the Feide `eduPersonPrincipalName`, use Option B.
5. Confirmation that the institution allows the `score`, `lineitem.readonly` and `contextmembership.readonly` scopes, and has not restricted them in the key UI.

## 11. Doc/code discrepancies noticed (for the record)

- `link_selection`: the doc says one item at a time (C:`doc/api/link_selection_placement.md:36`), but the code sends `accept_multiple: true` (C:`lib/lti/messages/deep_linking_request.rb:93`). The tool should follow the claim.
- Login parameter: the doc table says `deployment_id` (C:`doc/api/lti_launch_overview.md:45`), but the code sends `lti_deployment_id` (C:`lib/lti/lti_advantage_adapter.rb:220`), the standard name.
- `canvas_environment`: the doc says "production" (C:`doc/api/lti_launch_overview.md:54`); the code sends `test_cluster_name || "prod"` (C:`lib/lti/lti_advantage_adapter.rb:223`).
