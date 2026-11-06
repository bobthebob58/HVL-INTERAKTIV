/**
 * libraryBuildSecrets — finds a build machine's secrets baked into the text of an H5P library, by name only.
 *
 * Why: a library build that bakes `process.env` into its JavaScript (webpack's DefinePlugin, as H5P.AudioRecorder 1.0
 *      does) ships the build machine's tokens to every learner and into every image (D-110 amendments of 2026-11-05
 *      and 2026-11-06). Every way a library gets in runs these rules: the bundle tool, the seed command, an
 *      administrator's package import and the check of an installed library folder.
 * Spec: H5P-003, H5P-011, NFR-007
 * Invariants:
 *   - WHY: no import and only erasable TypeScript, so tools/h5p-bundle loads this file with Node's own type stripping
 *     and the server through tsx: one copy of the rules for every way in.
 *   - SECURITY: a finding is a variable name, or the kind of a value in brackets; a value is never returned.
 *   - Rules: a secret-like name with a literal value; a value that is a URL with a password or is shaped like a known
 *     credential; in an environment dump, every key the minimal build environment (`buildEnv` 3) does not produce.
 *     They also run on the text with escaped quotes undone, so JSON inside a string is scanned too.
 *   - SECURITY: a value is looked at, never consumed, so a text that ends in `word:` (`"Score:"`) cannot swallow the
 *     name after it. The dump search parses each `{` once within a work budget; a text that uses it up is a finding
 *     (`(too complex to scan)`), never skipped.
 * Collaborators: tools/h5p-bundle/contentTypeBundle.mjs, ./librarySecretFindings.ts (the server's file readers).
 * Tests: apps/server/test/h5p/libraries/libraryBuildSecrets.test.ts, tools/h5p-bundle/test/bundleSecretGuard.test.mjs
 */

/** The text files that are scanned; images, fonts and media are not read. */
export const SCANNED_TEXT_FILE = /\.(?:js|mjs|cjs|json|html?|css|txt|md|svg|xml|map|vtt|webvtt|csv|ya?ml)$/i;

/** A text file larger than this is refused rather than scanned, so a scan never reads an unbounded file. */
export const MAX_SCANNED_FILE_BYTES = 32 * 1024 * 1024;

/** The finding for a text whose environment-dump search used up its work budget. */
export const TOO_COMPLEX_TO_SCAN = '(too complex to scan)';

/**
 * The keys an environment dump may hold: exactly those a library build with the minimal build environment produces
 * (`PATH`, `HOME`, `NODE_ENV` and npm 11's own keys; D-110 amendment of 2026-11-06). SECURITY: `npm_config_*` is
 * listed name by name, because npm exports every setting under that prefix, a registry token or a proxy password too.
 */
export const BUILD_ENVIRONMENT_KEYS: ReadonlySet<string> = new Set(
  `COLOR EDITOR HOME INIT_CWD NODE NODE_ENV PATH PWD npm_command npm_execpath npm_lifecycle_event npm_lifecycle_script
  npm_node_execpath npm_package_json npm_package_name npm_package_version npm_config_allow_scripts npm_config_cache
  npm_config_global_prefix npm_config_globalconfig npm_config_init_module npm_config_local_prefix npm_config_node_gyp
  npm_config_noproxy npm_config_npm_version npm_config_prefix npm_config_user_agent npm_config_userconfig`.split(
    /\s+/,
  ),
);

/** Values shaped like a credential, whatever their name, with the kind a finding reports. */
const CREDENTIAL_SHAPES: readonly (readonly [string, RegExp])[] = [
  // WHY: after the first `:`, a password may hold more (RFC 3986 userinfo), but never `/`, so a port is not one.
  ['a URL with a password', /\b[a-z][a-z0-9+.-]*:\/\/[\w.~%!$&()*+,;=-]*:[\w.~%!$&()*+,;=:-]+@[\w[]/i],
  ['a GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_\w{22,})/],
  ['a GitLab token', /\bglpat-[\w-]{20,}/],
  ['an npm token', /\bnpm_[A-Za-z0-9]{36}\b/],
  ['a Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['an AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['a Google API key', /\bAIza[\w-]{35}(?![\w-])/],
  ['a JSON Web Token', /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/],
  ['a private key', /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/],
];

const KEY = String.raw`[A-Za-z_$][\w$]*|"(?:[^"\\\n]|\\.){1,256}"|'(?:[^'\\\n]|\\.){1,256}'`;
const STRING = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|\x60[^\x60]*\x60`;
const NUMBER = String.raw`-?\.?\d[\w.+-]*`;
/** A `name:` anywhere in a text, with the string or number after it looked at, not consumed. */
const PAIR = new RegExp(String.raw`(?<![\w$.])(${KEY})\s*:\s*(?=(${STRING}|${NUMBER}))`, 'g');
/** One pair of a flat object literal at a position, then `,` or `}`. */
const PAIR_AT = new RegExp(
  String.raw`\s*(${KEY})\s*:\s*(?:${STRING}|${NUMBER}|!0|!1|true|false|null|void 0)\s*([,}])`,
  'y',
);
/** A key that may belong to an environment dump. */
const DUMP_MARKER = /(?<![\w$])["']?(?:npm_\w+|PATH|HOME)["']?\s*:/g;

/** Secret words as whole words of a name (any case), or as the last word of a mixed- or lower-case name. */
const SECRET_WORD =
  /^(?:tokens?|secrets?|password|passwd|passphrase|credentials?|jwt|bearer|webhook|apikey|authtoken|privatekey|accesskey)$/;
/** In an upper-case name, secret words also inside a longer word (`PGPASSWORD`, `GITHUBTOKEN`, `CLIENTSECRET`). */
const SECRET_INSIDE = /TOKEN|SECRET|PASSW(?:OR)?D|PASSPHRASE|CREDENTIAL|APIKEY|PRIVATEKEY|ACCESSKEY/;
/** Words that say secret only at the end, after a prefix (`NPM_AUTH`, `GH_PAT`, `SESSION_COOKIE`, `SENTRY_DSN`). */
const SUFFIX_WORD = /^(?:auth|pass|pat|cookies?|dsn)$/;
const KEY_WORD = /^keys?$/;
const KEY_PREFIX = /^(?:api|access|private|secret|signing|encryption|master|client)$/;

const unquote = (key: string): string => (/^["']/.test(key) ? key.slice(1, -1).replace(/\\(.)/g, '$1') : key);

const wordsOf = (name: string): string[] =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * How strongly a name says secret: 2 with any literal value, 1 with a string only, 0 not at all.
 * WHY: upper-case names are environment variables, so they match anywhere and with a number too, except a bare
 * `_KEY` ending (`ENTER_KEY:13` is a key code); other names match by their last word only, with a word before it,
 * since one word such as `token` or `password:"Passord"` is ordinary code or an interface text.
 */
function secretNameStrength(name: string): 0 | 1 | 2 {
  const words = wordsOf(name);
  const last = words.at(-1) ?? '';
  const prefixed = words.length > 1;
  const keyAfter = (index: number) =>
    KEY_WORD.test(words[index] ?? '') && KEY_PREFIX.test(words[index - 1] ?? '');
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
    if (SECRET_INSIDE.test(name) || words.some((word, i) => SECRET_WORD.test(word) || keyAfter(i))) return 2;
    if (prefixed && SUFFIX_WORD.test(last)) return 2;
    return prefixed && KEY_WORD.test(last) ? 1 : 0;
  }
  return prefixed && (SECRET_WORD.test(last) || SUFFIX_WORD.test(last) || keyAfter(words.length - 1)) ? 1 : 0;
}

type FlatObject = { readonly keys: string[]; readonly end: number } | null;

/** The keys of the flat object literal (literal values only) that opens at `open`; each pair costs one unit of work. */
function flatObjectAt(text: string, open: number, work: { left: number }): FlatObject {
  const keys: string[] = [];
  PAIR_AT.lastIndex = open + 1;
  for (let pair = PAIR_AT.exec(text); pair && work.left >= 0; pair = PAIR_AT.exec(text)) {
    work.left -= 1;
    keys.push(unquote(pair[1] ?? ''));
    if (pair[2] === '}') return { keys, end: PAIR_AT.lastIndex };
  }
  return null;
}

/**
 * In each environment dump of the text, the keys the minimal build environment does not produce; undefined when the
 * search used up its work budget (a pair parsed or a `{` tried is one unit; a quarter of the text's length in all).
 */
function keysOutsideBuildEnvironment(text: string): string[] | undefined {
  const found: string[] = [];
  const work = { left: 4096 + text.length / 4 };
  const parsed = new Map<number, FlatObject>();
  let [braces, after, parsedTo]: [number[] | undefined, number, number] = [undefined, 0, -1];
  for (const marker of text.matchAll(DUMP_MARKER)) {
    if (marker.index < parsedTo) continue;
    braces ??= [...text.matchAll(/\{/g)].map((brace) => brace.index);
    while ((braces[after] ?? Infinity) < marker.index) after += 1; // markers come in order: `after` only grows
    let object: FlatObject = null;
    // WHY: a `{` inside an earlier string value fails to parse; the next one back is tried, at most 64 of them.
    for (let k = after - 1, tries = 0; k >= 0 && tries < 64 && !object; k--, tries++) {
      const open = braces[k] ?? 0;
      work.left -= 1;
      if (!parsed.has(open)) parsed.set(open, flatObjectAt(text, open, work));
      const candidate = parsed.get(open) ?? null;
      if (candidate && candidate.end > marker.index) object = candidate;
    }
    if (work.left < 0) return undefined;
    if (!object) continue;
    parsedTo = object.end;
    const keys = new Set(object.keys);
    if (object.keys.some((key) => key.startsWith('npm_')) || (keys.has('PATH') && keys.has('HOME')))
      found.push(...object.keys.filter((key) => !BUILD_ENVIRONMENT_KEYS.has(key)));
  }
  return found;
}

function scanText(text: string, names: Set<string>, kinds: Set<string>): void {
  // A reported pair is cut out of `rest`, so a credential-shaped value under a name is reported once, by its name.
  let [rest, from] = ['', 0];
  for (const pair of text.matchAll(PAIR)) {
    const [head, rawKey = '', value = ''] = pair;
    const quoted = /^["'\x60]/.test(value);
    // WHY: an empty value holds nothing, and a template with `${…}` is code, not a baked-in value.
    if ((quoted && value.length === 2) || (value.startsWith('`') && value.includes('${'))) continue;
    const strength = secretNameStrength(unquote(rawKey));
    const shaped = quoted && CREDENTIAL_SHAPES.some(([, shape]) => shape.test(value));
    if (strength < 2 && !(strength === 1 && quoted) && !shaped) continue;
    names.add(unquote(rawKey));
    const end = pair.index + head.length + value.length;
    if (end > from) [rest, from] = [`${rest}${text.slice(from, Math.max(from, pair.index))} `, end];
  }
  rest += text.slice(from);
  for (const [kind, shape] of CREDENTIAL_SHAPES) if (shape.test(rest)) kinds.add(`(${kind})`);
  const outside = keysOutsideBuildEnvironment(text);
  if (!outside) kinds.add(TOO_COMPLEX_TO_SCAN);
  for (const key of outside ?? []) names.add(key);
}

/**
 * The secrets a text file holds, by name.
 * @param text - The file's contents.
 * @returns The variable names, sorted, then the kinds of credential-shaped values that have no name, in brackets
 *   (`(a GitHub token)`), and `(too complex to scan)` for a text the dump search could not finish; without repeats,
 *   and empty when the file is clean. Never a value.
 */
export function buildSecretsIn(text: string): string[] {
  const names = new Set<string>();
  const kinds = new Set<string>();
  scanText(text, names, kinds);
  // SECURITY: `"{\"GH_TOKEN\":\"…\"}"`, an environment serialised into a string, is scanned with its quotes undone.
  const unescaped = text.replace(/\\+(["'\x60])/g, '$1');
  if (unescaped !== text) scanText(unescaped, names, kinds);
  return [...[...names].sort(), ...[...kinds].sort()];
}
