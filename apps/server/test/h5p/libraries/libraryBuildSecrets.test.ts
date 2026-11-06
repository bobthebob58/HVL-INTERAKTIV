/**
 * Tests for the build-secret rules every way a library gets in shares: names that say secret, values that are only
 * looked at (a text ending in `word:` hides nothing), URLs with a password, credential-shaped values and JSON inside
 * strings; never a value in a finding (D-110 amendment of 2026-11-06). The environment-dump rules are tested in
 * buildEnvironmentDumps.test.ts. Every secret here is made up, the credential-shaped ones put together at run time.
 *
 * Spec: H5P-003
 */
import { describe, expect, it } from 'vitest';
import {
  buildSecretsIn,
  MAX_SCANNED_FILE_BYTES,
  SCANNED_TEXT_FILE,
} from '../../../src/h5p/libraries/libraryBuildSecrets.js';

const made = (prefix: string, length: number, alphabet = 'Ab1'): string =>
  prefix + alphabet.repeat(length).slice(0, length);
const base64url = (json: object): string => Buffer.from(JSON.stringify(json)).toString('base64url');
/**
 * `{fn:f(),NAME:"x0",…}` with a made-up string value for each name. WHY: the call makes it no flat object literal, so
 * it is never taken for an environment dump (whose allowlist names every key) and only the name rules apply.
 */
const object = (names: readonly string[]): string =>
  `{fn:f(),${names.map((n, i) => `${n}:"x${i}"`).join(',')}}`;

/** One made-up value of each credential shape, with the kind a finding names. */
const SHAPED: readonly [string, string][] = [
  ['a GitHub token', made('ghp_', 36)],
  ['a GitHub token', made('gho_', 36)],
  ['a GitHub token', made('ghs_', 40)],
  ['a GitHub token', made('github_pat_', 40)],
  ['a GitLab token', made('glpat-', 20)],
  ['an npm token', made('npm_', 36)],
  ['a Slack token', made('xoxb-', 24, '12-')],
  ['an AWS access key', made('AKIA', 16, 'EXAMPLE7')],
  ['an AWS access key', made('ASIA', 16, 'EXAMPLE7')],
  ['a Google API key', made('AIza', 35)],
  ['a JSON Web Token', `${base64url({ alg: 'HS256' })}.${base64url({ sub: 'made-up-1' })}.${made('', 20)}`],
  ['a private key', `-----BEGIN ${'RSA PRIVATE'} KEY-----`],
];

describe('[H5P-003] the build-secret rules', () => {
  it('[H5P-003] names an upper-case secret name anywhere in it, with a string, template or number value', () => {
    // Arrange
    const text =
      '{GH_TOKEN:"x1",AWS_SECRET_ACCESS_KEY:\'x2\',SESSION_SECRET:`x3`,NPM_TOKEN:123456,API_KEY:"x4",' +
      'AWS_ACCESS_KEY_ID:"x5",JWT:"x6",DB_PASS:"x7",GH_PAT:"x8",SESSION_COOKIE:"x9",SENTRY_DSN:"x10",' +
      'NPM_AUTH:"x11",GPG_PASSPHRASE:"x12",SLACK_WEBHOOK_URL:"x13",URL_SIGNING_KEYS:"x14",AWS_CREDENTIALS:"x15",' +
      'STRIPE_KEY:"x16",AUTH_BEARER:"x17"}';
    // Act and assert
    expect(buildSecretsIn(text)).toEqual(
      [
        ...'API_KEY AUTH_BEARER AWS_ACCESS_KEY_ID AWS_CREDENTIALS AWS_SECRET_ACCESS_KEY DB_PASS GH_PAT GH_TOKEN'.split(
          ' ',
        ),
        ...'GPG_PASSPHRASE JWT NPM_AUTH NPM_TOKEN SENTRY_DSN SESSION_COOKIE SESSION_SECRET SLACK_WEBHOOK_URL'.split(
          ' ',
        ),
        ...['STRIPE_KEY', 'URL_SIGNING_KEYS'],
      ].sort(),
    );
  });

  it('[H5P-003] names an upper-case name whose secret word is joined to another word, as the old guard did', () => {
    // Arrange: libpq's PGPASSWORD and the like, and the one-word key forms; a number value counts too.
    const fused = [
      'PGPASSWORD',
      'CLIENTSECRET',
      'JWTSECRET',
      'ADMINPASSWD',
      'MYCREDENTIALS',
      'GPGPASSPHRASE',
    ];
    const keys = ['APIKEY', 'PRIVATEKEY', 'ACCESSKEY', 'GOOGLEAPIKEY'];
    // Act and assert
    expect(buildSecretsIn(object([...fused, ...keys]))).toEqual([...fused, ...keys].sort());
    expect(buildSecretsIn('{GITHUBTOKEN:9876543210}')).toEqual(['GITHUBTOKEN']);
  });

  it('[H5P-003] leaves alone empty values, code templates, key codes, single words and interface texts', () => {
    // Arrange: jQuery UI's `COOKIE` date format and H5P's own labels are in the real libraries.
    const text =
      '{EMPTY_TOKEN:"",TEMPLATE_TOKEN:`${a}`,ENTER_KEY:13,KEY_ENTER:"Enter",COOKIE:"D, dd M yy",' +
      'token:"a",password:"Passord",maxTokens:4096,tokenLabel:"Token",publicKey:"k",PATH:"/usr/bin"}';
    // Act and assert
    expect(buildSecretsIn(text)).toEqual([]);
  });

  it("[H5P-003] names other names by their last word: mixed case, lower case and npm's auth settings", () => {
    // Arrange: every secret word, the one-word key forms, every ending and every prefix of `Key`.
    const words = 'GhToken gh_token githubToken clientSecret dbPassword adminPasswd authBearer'.split(' ');
    const oneWord = 'my_apikey gpg_privatekey aws_accesskey npm_config__authtoken'.split(' ');
    const endings = 'npmAuth dbPass ghPat sessionCookie sentryDsn slackWebhook awsCredentials'.split(' ');
    const keys = 'apiKey accessKey privateKey secretKey signingKey encryptionKey masterKey clientKey'.split(
      ' ',
    );
    const names = [...words, ...oneWord, ...endings, ...keys];
    const npmUrl = 'npm_config_//registry.npmjs.org/:_authToken';
    // Act and assert
    expect(buildSecretsIn(object([...names, JSON.stringify(npmUrl)]))).toEqual([...names, npmUrl].sort());
  });

  it('[H5P-003] a text that ends in `word:` right before an object does not hide the name after it', () => {
    const cases: readonly [string, string][] = [
      ['console.log("env:",{API_TOKEN:"x1"});', 'API_TOKEN'],
      ['console.log("Config: ",{"DB_PASSWORD":"x2"});', 'DB_PASSWORD'],
      ["e.title='Score:',t={GITHUB_TOKEN:'x3'};", 'GITHUB_TOKEN'],
      ['l={a:"Svar:",b:`Poeng: `},t={npmAuth:"x4"};', 'npmAuth'],
    ];
    for (const [text, name] of cases) expect(buildSecretsIn(text), text).toEqual([name]);
  });

  it('[H5P-003] names a URL with a password under any name, and by its kind where it has no name', () => {
    // Arrange: proxy settings under names that say nothing secret; a password may hold a colon (RFC 3986).
    const named =
      '{HTTPS_PROXY:"http://u:x1@proxy:3128",https_proxy:"http://u:x2@proxy:3128",mirror:"https://u:x3@a.b",' +
      'DATABASE_URL:"postgresql://app:x4:y4@db:5432/x"}';
    // Act and assert
    expect(buildSecretsIn(named)).toEqual(['DATABASE_URL', 'HTTPS_PROXY', 'https_proxy', 'mirror']);
    expect(buildSecretsIn('fetch("https://u:x5@example.org/a")')).toEqual(['(a URL with a password)']);
    expect(buildSecretsIn('fetch("http://u:x6:y6@proxy:3128")')).toEqual(['(a URL with a password)']);
    expect(
      buildSecretsIn('{proxy:"http://proxy:3128",REDIS_URL:"redis://redis:6379",a:"https://a.b:443/x@y"}'),
    ).toEqual([]);
  });

  it('[H5P-003] names a credential-shaped value by its name, or by its kind, and never returns the value', () => {
    for (const [kind, value] of SHAPED) {
      // Act
      const named = buildSecretsIn(`var c={label:${JSON.stringify(value)}};`);
      const bare = buildSecretsIn(`call(${JSON.stringify(value)});`);
      // Assert
      expect(named, kind).toEqual(['label']);
      expect(bare, kind).toEqual([`(${kind})`]);
      expect(JSON.stringify([named, bare]), kind).not.toContain(value);
    }
  });

  it('[H5P-003] scans an environment serialised into a string, its quotes escaped once or twice', () => {
    expect(buildSecretsIn('var s="{\\"GH_TOKEN\\":\\"x1\\"}";')).toEqual(['GH_TOKEN']);
    expect(buildSecretsIn('var s="{\\\\\\"gh_token\\\\\\":\\\\\\"x2\\\\\\"}";')).toEqual(['gh_token']);
  });

  it('[H5P-003] the text files it reads and the size it caps', () => {
    for (const name of ['a.js', 'b.json', 'c.css', 'd.svg', 'e.vtt', 'f.html', 'g.map', 'h.MJS'])
      expect(SCANNED_TEXT_FILE.test(name), name).toBe(true);
    for (const name of ['a.png', 'b.woff2', 'c.mp4', 'd.pdf'])
      expect(SCANNED_TEXT_FILE.test(name), name).toBe(false);
    expect(MAX_SCANNED_FILE_BYTES).toBe(32 * 1024 * 1024);
  });
});
