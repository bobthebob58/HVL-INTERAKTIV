# Feide OpenID Connect: evidence for `feide-oidc-config.example.json`

- **Item:** 4, a stand-in for `docs/reference/feide-oidc-config.example.json` (spec 02, `AUTH-001`…`AUTH-005`).
- **Retrieved:** 2026-10-16. *What HVL IT registers* added on 2026-10-23 to match the Session 3 code.
- **Status:** assembled from public documentation. Replace it with the Feide Customer Portal export.

## How this was gathered (and its limits)

The build container cannot reach `docs.feide.no`, `auth.dataporten.no` or `kunde.feide.no` (HTTP 403, or a DNS
failure from WebFetch). So the live discovery document was **not** fetched. The evidence comes from three places:

1. **docs.feide.no**, read only through web-search snippets (marked *snippet* below). The quotes are the
   search engine's extracts of the official pages.
2. **Public source code**, read from shallow, sparse git clones. Each is cited as `repo@commit path:line`. The
   most important is `feideconnect/feideconnect-authengine`, the operator's own Dataporten AuthEngine. That
   repository is archived; its last commit is dated 2018-02-16.
3. **npm tarballs**, fetched with `npm pack --ignore-scripts`. They were read and never executed.

**Confidence levels:**

- **high:** a primary or official source seen directly, or two independent sources that agree.
- **medium:** one credible secondary source.
- **low:** inferred.

## Source key

| ID | Source | Kind |
|---|---|---|
| F-OIDC | https://docs.feide.no/reference/oauth_oidc/openid_connect_details.html | Official docs (snippet) |
| F-LOGOUT | https://docs.feide.no/service_providers/manage/openid_connect/redir_etter_logout.html | Official docs (snippet) |
| F-TOKENS-HOWTO | https://docs.feide.no/service_providers/openid_connect/feide_obtaining_tokens.html | Official docs (snippet) |
| F-ATTRGROUPS | https://docs.feide.no/reference/schema/attributegroups/index.html | Official docs (snippet) |
| F-USERINFO | https://docs.feide.no/reference/apis/userinfo.html | Official docs (snippet) |
| F-TOKENS | https://docs.feide.no/reference/tokens.html | Official docs (snippet) |
| F-GROUPS | https://docs.feide.no/reference/apis/groups_api/groups_endpoints.html | Official docs (snippet) |
| F-ORGGROUP | https://docs.feide.no/reference/apis/groups_api/group_types/he_organization.html | Official docs (snippet) |
| F-FSCOURSE | https://docs.feide.no/reference/apis/groups_api/group_types/fs_course.html | Official docs (snippet) |
| F-FSPRG | https://docs.feide.no/reference/apis/groups_api/group_types/fs_program_of_study.html | Official docs (snippet) |
| F-AFFIL | https://docs.feide.no/reference/schema/attributes/edupersonaffiliation.html | Official docs (snippet) |
| F-MANAGE | https://docs.feide.no/service_providers/manage/openid_connect/managing_applications.html | Official docs (snippet) |
| G-AUTHENGINE | `feideconnect/feideconnect-authengine@851518863f885eae9de6cab6a497ac1768fbf187` (2018-02-16) | Operator source code (archived) |
| G-INDOK | `rubberdok/indok-api@eaddedd7ce0f9905aab2f88bd80203ea8d2e3f80` (2025-01-23) | Third-party test fixture labelled "From https://auth.dataporten.no/.well-known/openid-configuration" |
| G-NAV | `Uninett/nav@6b8111cfeb0738f1a8de80855d8896127ee14adf` | Uninett (Feide's former operator) product documentation |
| G-TIHLDE | `TIHLDE/Codex@b9007ec5b8ebb0738fc8f88cb34fc26a1f7f0313` | Third-party docs that reproduce the ID token example from F-TOKENS |
| G-DJDP | `JakobGM/django-dataporten@2d9888a8167a74781a78dfe21c0638cf44f980dc` | Third-party recorded `/groups/me/groups` response |
| G-NDLA | `NDLANO/backend@5b76a04f96bdf61c2753bf4279f3f65f6d4b701f` | NDLA production code |
| G-OSLO | `Oslo-kommune-Utdanningsetaten/ki@674f86654d9321e3a647f254f1ff10fef42fe28a` | Oslo municipality (education agency) production code |
| G-DOTKOM | `dotkom/monoweb@de990601428f4f38e54fec6b766c354a874e2032` | Third-party production code |
| N-NODEBB | npm `nodebb-plugin-feide-oauth@0.0.16` | Third-party package |
| N-NEXTAUTH | npm `feide-provider-next-auth@1.0.0` | Third-party package |
| N-AUTHJS | npm `@kjartanm/feide-authjs@0.0.4` | Third-party package |
| GH-SEARCH | GitHub code-search hits (not cloned): `MAKENTNU/web src/web/settings.py`, `rubberdok/indok-web frontend/.env.production`, `BIBSYSDEV/nva-identity-service template.yaml`, `Hansi132/App2000Election …/application.properties`, `webkom/lego lego/settings/base.py` | Third-party code, read through search excerpts only |

## Evidence table

### Provider metadata

| Value | Result | Evidence (exact quote where available) | Confidence |
|---|---|---|---|
| Issuer | `https://auth.dataporten.no` | G-AUTHENGINE `etc/authengine/config.json:30` `"issuer": "https://auth.dataporten.no"`. G-INDOK `auth.test.ts:679` `issuer: "https://auth.dataporten.no"`. G-TIHLDE `page.md:168` `"iss": "https://auth.dataporten.no"` (ID token example from F-TOKENS). N-NODEBB `library.js:100`. N-AUTHJS `dist/index.js:6`. | high |
| Discovery URL | `https://auth.dataporten.no/.well-known/openid-configuration` | F-LOGOUT (snippet): "The logout endpoint can be found as the attribute end_session_endpoint at the discovery endpoint https://auth.dataporten.no/.well-known/openid-configuration". G-NAV `mod_auth_openidc_feide.rst:101` `OIDCProviderMetadataURL https://auth.dataporten.no/.well-known/openid-configuration`. G-OSLO `backend/.env-example:7`. N-NEXTAUTH `index.ts:69`. G-AUTHENGINE `lib/Router.php:65`. | high |
| Authorization endpoint | `https://auth.dataporten.no/oauth/authorization` | G-AUTHENGINE `OpenIDConnect.php:47` (`$base . 'authorization'`, base `…/oauth/`) and `Router.php:41`. G-INDOK `auth.test.ts:680`. G-TIHLDE `page.md:24`. N-NODEBB `library.js:101`. N-NEXTAUTH `index.ts:71`. | high |
| Token endpoint | `https://auth.dataporten.no/oauth/token` | G-AUTHENGINE `OpenIDConnect.php:48` and `Router.php:43`. G-INDOK `auth.test.ts:681`. N-NODEBB `library.js:102`. N-AUTHJS `dist/index.js:7`. | high |
| Userinfo endpoint | `https://auth.dataporten.no/openid/userinfo` | G-AUTHENGINE `OpenIDConnect.php:51` and `Router.php:67`. G-INDOK `auth.test.ts:687`. N-NODEBB `library.js:104`. F-USERINFO (snippet) gives the endpoint as https://auth.dataporten.no/openid/userinfo: "Clients must present a valid access token to retrieve the userinfo claims." | high |
| JWKS URI | `https://auth.dataporten.no/openid/jwks` | G-AUTHENGINE `OpenIDConnect.php:54` and `Router.php:66`. G-INDOK `auth.test.ts:690`. GH-SEARCH: `BIBSYSDEV/nva-identity-service template.yaml` `jwks_uri: "https://auth.dataporten.no/openid/jwks"`. | high |
| End-session endpoint | `https://auth.dataporten.no/openid/endsession` | G-INDOK `auth.test.ts:721` `end_session_endpoint: "https://auth.dataporten.no/openid/endsession"`. G-OSLO `views/auth.py:190` reads `end_session_endpoint` from discovery. GH-SEARCH `MAKENTNU/web settings.py`: "This URL is the value of the `end_session_endpoint` key from https://auth.dataporten.no/.well-known/openid-configuration" → `"https://auth.dataporten.no/openid/endsession"`. F-LOGOUT (snippet) confirms the key exists. (The 2018 G-AUTHENGINE has no logout endpoint, so it was added later.) | high |
| PKCE | `S256` supported | F-OIDC (snippet): PKCE "may be used with the authorization code flow and the hybrid flow", listing `code_challenge_method: S256`. G-INDOK `auth.test.ts:701` `code_challenge_methods_supported: ["S256"]`. N-NEXTAUTH `index.ts:77` and N-AUTHJS `dist/index.js:12` use `checks: ["pkce", "state"]`. G-NAV `allauth-and-oidc.rst:246`: "If you choose "Client type": "Public" you must set ``oauth_pkce_enabled`` to True." | high |
| Client authentication at the token endpoint | `client_secret_basic`, `client_secret_post` | G-AUTHENGINE `OpenIDConnect.php:49`. G-INDOK `auth.test.ts:682-685`. F-TOKENS-HOWTO (snippet): "The request is authenticated with HTTP Basic authentication using the client_id and the client secret." | high |
| ID token signing algorithm | `RS256` | G-AUTHENGINE `OpenIDConnect.php:57`. G-INDOK `auth.test.ts:700` `id_token_signing_alg_values_supported: ["RS256"]`. | high |
| Response types | `code` (also `code id_token`, `id_token token`) | G-INDOK `auth.test.ts:692`. G-AUTHENGINE `OpenIDConnect.php:55` (2018: `code`, `id_token token`). F-MANAGE (snippet): Authorization Code Grant is "recommended for all application types". | high for `code` |
| Subject type | `public` | G-INDOK `auth.test.ts:699`. G-AUTHENGINE `OpenIDConnect.php:56`. | high |
| `scopes_supported` in discovery | `["openid", "profile", "email"]` (Feide attribute-group names are accepted as scopes as well) | G-INDOK `auth.test.ts:720`. F-ATTRGROUPS / F-TOKENS-HOWTO (snippet): "Names of attribute groups can be used as scopes in Feide." | high |
| RP-initiated logout | Supported. Redirect the browser to `end_session_endpoint` with `post_logout_redirect_uri` and `id_token_hint`. | F-LOGOUT (snippet): "On logout, the service should redirect the user's browser to the logout endpoint. Feide will terminate the session for the service, and redirect the browser." "The following parameters must be given: post_logout_redirect_uri: URL to redirect the user to after logout. id_token_hint: ID token that the service received on login." G-OSLO `views/auth.py:190-195` sends exactly these two parameters. | high |

### Scopes and attribute groups

The scopes in `AUTH-001` are listed first.

| Scope | What it releases | Evidence | Confidence |
|---|---|---|---|
| `openid` | Turns on OIDC; it is also needed for `login_hint`. If **only** `openid` is sent, the token covers every attribute group configured for the client. Explicit scopes narrow the token. | F-TOKENS-HOWTO (snippet): "Typically, the authorization request will only mention the openid scope. The resulting access token will be authorized for all attribute groups that are configured for the service." and "If a more restrictive access token is wanted, the desired scopes can be requested explicitly." F-ATTRGROUPS (snippet): "the scopes openid and userid are automatically authorized" when an OIDC configuration is added. | high |
| `profile` | `name` if `userinfo-name` is authorised. `picture` if `userinfo-photo` is authorised. | F-ATTRGROUPS / F-USERINFO (snippet): "The standard profile scope returns name and picture, but which of these, if any, are returned depends on which of the attribute groups userinfo-name and userinfo-photo are authorized." G-INDOK `auth.test.ts:720` lists `profile` in `scopes_supported`. | high |
| `email` | `email`. `email_verified` is always `false`. | F-ATTRGROUPS (snippet): "The email claim requires the email attribute group", and "email_verified will always be false since Feide does not verify email addresses". | high |
| `userid-feide` | The Feide ID (`eduPersonPrincipalName`) in claim `https://n.feide.no/claims/eduPersonPrincipalName`, plus a `feide:` entry in `https://n.feide.no/claims/userid_sec`. | F-ATTRGROUPS (snippet): "The Feide ID (eduPersonPrincipalName) is tied to this group." G-NAV `mod_auth_openidc_feide.rst:54,106-107`: "the ``userid-feide`` scope needs to be turned on at *User information > Personal information*", with `OIDCScope "openid userid-feide"`. G-TIHLDE `page.md:179-180`. | high |
| `groups-org` | Groups API organisation groups: `fc:org`, and org units `fc:orgunit`. | F-ORGGROUP (snippet): "available with the groups-org attribute group / scope", "available for higher education". G-OSLO `views/auth.py:127-128` requests `groups-org`. N-NODEBB `library.js:108`. | high |
| `groups-edu` | Groups API FS groups in higher education: course `fc:fs:emne`, programme `fc:fs:prg` and others. It also covers primary and secondary education groups. | F-FSCOURSE (snippet): "Retrieving these groups requires the groups-edu attribute group/scope. This group type is available for higher education, where the organization has enabled the integration with Felles Studentsystem (FS)." F-FSPRG (snippet): "To retrieve these groups, the application needs access to the groups-edu attribute group / scope." G-OSLO `views/auth.py:128`. N-NODEBB `library.js:108`. | high |

Other scopes and attribute groups that appeared in the evidence:

| Scope | What it releases | Evidence | Confidence |
|---|---|---|---|
| `userid` | Auto-authorised. Many clients send it explicitly. | F-ATTRGROUPS (snippet). N-NEXTAUTH `index.ts:50` uses the base scopes `["openid", "userid", …]`. G-OSLO `views/auth.py:127`. | high |
| `userinfo-name`, `userinfo-photo`, `userinfo-language` | Name, photo and preferred language. These can be requested directly as scopes. | N-NODEBB `library.js:108` (`… userinfo-photo … userinfo-language userid userinfo-name …`). F-ATTRGROUPS (snippet). | medium (one official snippet plus one package) |
| `userid-nin` | The national identity number, in claim `https://n.feide.no/claims/nin`. **Must never be requested (AUTH-004).** | F-USERINFO (snippet): `userid_sec` content depends on "userid-feide, userid-nin, userid-edugain, userid-social and eidas". G-INDOK `auth.test.ts:709` lists `https://n.feide.no/claims/nin` in `claims_supported`. | high |
| `groups-other`, `groups-memberids` | Other groups, and membership IDs. `groups-memberids` is moderated by Sikt. HVL does not need either. | F-ATTRGROUPS (snippet). | medium |

### Claims (ID token and userinfo)

| Claim | Meaning | Evidence | Confidence |
|---|---|---|---|
| `sub` | Stable user ID (UUID form), subject type `public` | G-TIHLDE `page.md:171` `"sub": "76a7a061-3c55-430d-8ee0-6f82ec42501f"` (example copied from F-TOKENS). F-USERINFO (snippet) sample has the same `sub`. | high |
| `https://n.feide.no/claims/eduPersonPrincipalName` | Feide ID, e.g. `jk@uninett.no` | G-TIHLDE `page.md:180`. G-INDOK `auth.test.ts:708`. G-NAV `mod_auth_openidc_feide.rst:106`. G-OSLO `views/auth.py:165-166`. G-NDLA `network/src/main/scala/no/ndla/network/jwt/JwtDecoder.scala:37-38`. | high |
| `https://n.feide.no/claims/userid_sec` | An array of namespaced IDs, e.g. `["feide:jk@uninett.no"]` | G-TIHLDE `page.md:179`. F-USERINFO (snippet): "Contains a namespaced user ID, e.g. Feide identifier." | high |
| `dataporten-userid_sec` | Deprecated alias of the claim above | F-USERINFO (snippet): "Deprecated. Same as https://n.feide.no/claims/userid_sec." G-INDOK `auth.test.ts:704`. | high |
| `name`, `email`, `email_verified`, `picture` | Standard claims, released according to the authorised attribute groups | G-TIHLDE `page.md:176-178`. G-INDOK `auth.test.ts:704-716`. F-USERINFO (snippet). | high |
| `aud` in the userinfo response | Feide added it to ease migration from the legacy endpoint | lister.sikt.no feide-updates thread (search result; undated in the snippet) | medium |

### Groups API

| Value | Result | Evidence | Confidence |
|---|---|---|---|
| Groups API base URL | `https://groups-api.dataporten.no/groups` | F-GROUPS (snippet): "The base URL is https://groups-api.dataporten.no/groups", and the table lists `/me/groups`. | high |
| User's groups | `GET https://groups-api.dataporten.no/groups/me/groups` with `Authorization: Bearer <access token>` | G-NDLA `FeideApiClient.scala:87`. G-OSLO `utils.py:30-33`. G-DOTKOM `feide-groups-repository.ts:28-31`. N-AUTHJS `README.md:70-71`. GH-SEARCH `webkom/lego lego/settings/base.py`. lister.sikt.no feide-updates post (snippet). | high |
| Response shape | A JSON array of group objects `{ id, type, displayName, parent?, membership?, … }` | G-DJDP `groups.json:1-33,443-480`. G-DOTKOM `feide-groups-repository.ts:81-94` (zod schema: `id`, `type`, `displayName`, `parent?`, `membership?{basic, displayName?, notAfter?, notBefore?}`). | high |
| Organisation group | `type: "fc:org"`, `id: "fc:org:<realm>"` | F-ORGGROUP (snippet): id "fc:org:<realm>, where the realm is the domain name". G-DJDP `groups.json:449,471` (`"id": "fc:org:ntnu.no"`, `"type": "fc:org"`). G-NDLA `FeideApiClient.scala:33` `val FC_ORG = "fc:org"`. G-OSLO `utils.py:86,90`. | high |
| `membership.affiliation` | An array, e.g. `["member","employee","faculty"]` | F-ORGGROUP (snippet): the example has "an `affiliation` list of member, employee, and faculty, and a `primaryAffiliation` of "employee"", with `basic` "admin". G-DJDP `groups.json:454-465` (`"affiliation": ["employee","member","affiliate","student"]`, `"primaryAffiliation": "employee"`, `"basic": "admin"`). | high |
| `membership.primaryAffiliation` | A single string, e.g. `"employee"` | Same as the row above. G-OSLO `utils.py:87` `group['membership']['primaryAffiliation'] == "employee"`. | high |
| Allowed affiliation values | `faculty`, `student`, `staff`, `alum`, `member`, `affiliate`, `employee`, `library-walk-in` | F-AFFIL (snippet) lists these as permissible values. A student has `member`+`student`. Educational staff have `member`+`employee`+`faculty`. Other staff have `member`+`employee`+`staff`. | high |
| `membership` only on per-user calls | Present only when you request a specific user's groups | F-ORGGROUP and F-FSCOURSE (snippet) | high |
| FS course group | `type: "fc:fs:emne"`, `id: "fc:fs:fs:emne:<realm>:<course-code>:<version>"`; needs `groups-edu` | F-FSCOURSE (snippet). G-DJDP `groups.json:19-21`. G-DOTKOM `feide-groups-repository.ts:4,74`. | high |
| FS programme group | `type: "fc:fs:prg"`, `id: "fc:fs:fs:prg:<realm>:<programme-code>"`; needs `groups-edu` | F-FSPRG (snippet). G-DJDP `groups.json:4-6`. | high |

### Login hint

| Value | Result | Evidence | Confidence |
|---|---|---|---|
| `login_hint` | `feide\|realm\|<realm>` preselects the organisation, and `feide\|all` shows the picker. It needs scope `openid`, and the portal option "Always require user interaction" must be unchecked. | F-OIDC (snippet). G-OSLO `views/auth.py:129` `login_hint=f"feide\|realm\|{feide_realm}"`. N-NODEBB `library.js:110` `loginHint: "feide\|all"`. | high |

### HVL-specific values

| Value | Result | Evidence | Confidence |
|---|---|---|---|
| HVL Feide realm / org group | `hvl.no` / `fc:org:hvl.no` (assumed) | Spec 02 assumes `hvl.no`, and HVL's e-mail domains are `hvl.no` and `stud.hvl.no` (search result covering HVL's Covidence licence). GitHub code search for `"fc:org:hvl.no"` and `"realm\|hvl.no"` returned 0 hits. **No public source confirms it.** | low |

### Customer Portal registration fields

| Field | Evidence | Confidence |
|---|---|---|
| "Add OIDC-configuration" under the Configurations tab | F-MANAGE (snippet) | high |
| "Configuration name" | F-MANAGE (snippet). G-NAV `mod_auth_openidc_feide.rst:48-51`. | high |
| "Redirect URI after login" (can be changed later) | F-MANAGE (snippet). G-NAV `mod_auth_openidc_feide.rst:131-133`. | high |
| "Redirect URI for logout" (several allowed through "+ Add URI") | F-LOGOUT (snippet) | high |
| Client ID (fixed, generated) and client secret (changeable) | G-NAV `mod_auth_openidc_feide.rst:126-128`: "``OIDCClientID`` needs to be set to the fixed generated *client id*, while ``OIDCClientSecret`` needs to be set to the changeable ``client secret``". | high |
| "Client type": "Public" (PKCE required for public clients) | G-NAV `allauth-and-oidc.rst:246` | medium |
| Attribute groups ("User information > Personal information" for `userid-feide`) | G-NAV `mod_auth_openidc_feide.rst:54-55`. F-ATTRGROUPS (snippet): "administrators configure them in the Feide customer portal". | high |
| "Restrict login to selected organizations" | F-MANAGE (snippet) | high |
| Login providers ("Allow other login methods"; Feide test users must be disabled before production) | F-MANAGE (snippet) | high |
| "Always require user interaction" | F-OIDC (snippet), in the context of `login_hint` | high |
| Several redirect URIs on file at once | G-NAV `allauth-and-oidc.rst:249`: "Dataporten supports having multiple redirect urls on file simultaneously." | medium |
| Plain-HTTP redirect URIs are allowed only in development | F-TOKENS-HOWTO (snippet): "For an application in production you are required to only use HTTPS secured endpoints." | high |

## What HVL IT registers in the Customer Portal (matches the S3 code)

The server builds its Feide URLs on `PUBLIC_BASE_URL` (`apps/server/src/server/createApp.ts`), so the portal must
hold them exactly, for every origin the server runs on: production `https://interaktiv.hvl.no`, plus any test
server. Feide accepts plain-HTTP URIs such as `http://localhost:3000/…` for development only.

| Customer Portal field | Value | Where the server uses it |
|---|---|---|
| Redirect URI after login | `<PUBLIC_BASE_URL>/auth/feide/callback`, e.g. `https://interaktiv.hvl.no/auth/feide/callback` | `redirect_uri` of the authorisation request and the code exchange (`apps/server/src/auth/feide/FeideClient.ts`); the route is `GET /auth/feide/callback` |
| Redirect URI for logout | `<PUBLIC_BASE_URL>/auth/logged-out`, e.g. `https://interaktiv.hvl.no/auth/logged-out` | `post_logout_redirect_uri` with `id_token_hint` at logout (`AUTH-003`); `GET /auth/logged-out` says goodbye and offers a new login |
| Client type | Confidential (client ID and client secret) | The server authenticates at the token endpoint with `client_secret_post`, which Feide supports alongside `client_secret_basic` |
| Attribute groups | `userinfo-name`, `email`, `userid-feide`, `groups-org`, `groups-edu`; **never** `userinfo-photo` or `userid-nin` | The server sends the scope `openid profile email userid-feide groups-org groups-edu` (`FEIDE_SCOPE`). Without `userid-feide` there is no Feide ID and every login is refused (D-054); without `groups-org` no one counts as an HVL member, so everyone is a learner (`AUTH-002`) |
| Restrict login to selected organizations | Off, if activities may be shared with "anyone with Feide" (`AUTH-002`) | Users from other organisations log in as learners and see only activities shared with Feide (D-059) |
| Always require user interaction | Either | The server sends no `login_hint` |
| Login providers | Feide; disable Feide test users before production | — |

What comes back goes into the server's environment (`apps/server/.env.example` documents each variable):

- `FEIDE_CLIENT_ID`: the generated client ID. `FEIDE_CLIENT_SECRET`: the client secret, in the secret store only.
- `FEIDE_ISSUER` (default `https://auth.dataporten.no`) and `FEIDE_GROUPS_API_URL` (default
  `https://groups-api.dataporten.no`) need no change for production.
- `ALLOWED_FEIDE_ORGS` (default `hvl.no`, realm still *(verify)*), `ADMIN_FEIDE_IDS` (Feide IDs of HVL members)
  and `AUTHOR_COURSE_GROUPS` (FS group IDs or prefixes, e.g. `fc:fs:fs:emne:hvl.no:<course code>`, which need
  HVL's FS integration in Feide *(verify)*).

## Conflicts and caveats

- **"Feide does not support the standard OIDC scopes".** G-NAV `python/nav/etc/webfront/authentication.toml:44` says
  this, but G-INDOK `scopes_supported: ["openid","profile","email"]` and F-ATTRGROUPS contradict it, and both of those say
  `profile` and `email` work. The likely explanation is that the scopes only take effect when the matching attribute
  groups are authorised in the Customer Portal. We treat `profile` and `email` as valid. **S3 must test this
  against Feide test users.**
- **Age of the evidence.** The newest full copy of the discovery document is the G-INDOK fixture, from a commit dated
  2025-01-23. G-AUTHENGINE dates from 2018 and does not include `end_session_endpoint` or PKCE. The live document must
  be fetched once from a network that can reach `auth.dataporten.no`, and its SHA-256 recorded, before S3 relies on
  optional fields.
- **Search snippets.** The docs.feide.no quotes come from a search engine's extracts, not from a page we opened. Each
  F-* row with high confidence is also backed by independent code or a fixture, except these, which rest on
  official-doc snippets alone:
  - the explicit-scope narrowing rule;
  - `email_verified` always `false`;
  - the Customer Portal field labels from F-MANAGE.
- **Data minimisation.** The ID token and userinfo return `name` and `email` for **every** user once `userinfo-name`
  and `email` are authorised. That includes learners. AUTH-004 must therefore be enforced in code: discard both before
  anything is persisted for learners. Checking the scope string alone is not enough.
- **Logout needs the ID token.** `id_token_hint` is mandatory, so the server has to keep the raw ID token for the
  life of the portal session. That token can hold the name and e-mail. Keep it only in the Redis session; never write
  it to PostgreSQL or the logs.

## Reproducing the evidence

The clones and tarballs were deleted after the values were extracted; only the deliverables are kept here.
To check a citation, re-clone the repository at the commit given in the source key (`git clone --filter=blob:none`,
then `git checkout <sha>`) or run `npm pack <name>@<version> --ignore-scripts`, and open the cited line.
