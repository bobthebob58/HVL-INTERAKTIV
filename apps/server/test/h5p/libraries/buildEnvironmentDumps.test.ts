/**
 * Tests for the environment-dump rule of the build-secret scan: a dumped build environment may hold only the keys
 * the minimal build environment produces, every other key is named, and the search is linear, with a text that uses
 * up its work budget refused as `(too complex to scan)` (D-110 amendment of 2026-11-06). Every value is made up.
 *
 * Spec: H5P-003
 */
import { describe, expect, it } from 'vitest';
import {
  BUILD_ENVIRONMENT_KEYS,
  buildSecretsIn,
  TOO_COMPLEX_TO_SCAN,
} from '../../../src/h5p/libraries/libraryBuildSecrets.js';

const dump = (keys: readonly string[]): string =>
  `var e={${keys.map((key, i) => `${/^\w+$/.test(key) ? key : JSON.stringify(key)}:"v${i}"`).join(',')}};`;

describe('[H5P-003] the environment-dump allowlist', () => {
  it('[H5P-003] allows exactly the 28 keys the minimal build environment produces', () => {
    // Arrange: the keys counted in the ten real packages (names only), each `npm_config_*` by name.
    const settings =
      'allow_scripts cache global_prefix globalconfig init_module local_prefix node_gyp noproxy';
    const expected = [
      ...'COLOR EDITOR HOME INIT_CWD NODE NODE_ENV PATH PWD npm_command npm_execpath'.split(' '),
      ...'npm_lifecycle_event npm_lifecycle_script npm_node_execpath npm_package_json'.split(' '),
      ...'npm_package_name npm_package_version'.split(' '),
      ...`${settings} npm_version prefix user_agent userconfig`.split(' ').map((s) => `npm_config_${s}`),
    ];
    // Act
    const clean = buildSecretsIn(dump([...BUILD_ENVIRONMENT_KEYS]));
    // Assert
    expect([...BUILD_ENVIRONMENT_KEYS].sort()).toEqual(expected.sort());
    expect(clean).toEqual([]);
  });

  it('[H5P-003] names every other key of a dump, also harmless-looking ones and npm settings', () => {
    // Arrange: a build machine's own variables, which the minimal environment never passes on.
    const extra = [
      'SHELL',
      'USER',
      'CI',
      'npm_config_registry',
      'npm_config_https_proxy',
      'npm_config_email',
    ];
    // Act and assert
    expect(buildSecretsIn(dump([...BUILD_ENVIRONMENT_KEYS, ...extra]))).toEqual([...extra].sort());
  });

  it('[H5P-003] knows a dump by PATH and HOME without npm, and leaves other flat objects and key maps alone', () => {
    expect(buildSecretsIn('{PATH:"/bin",HOME:"/home/x",LANG:"nb_NO.UTF-8"}')).toEqual(['LANG']);
    expect(buildSecretsIn('var labels={OK:"Riktig",PATH:"/usr/bin"};')).toEqual([]);
    expect(buildSecretsIn('keyCode:{BACKSPACE:8,END:35,HOME:36,LANG:1}')).toEqual([]);
  });

  it('[H5P-003] finds a dump whose values hold braces, and one inside an escaped string', () => {
    expect(buildSecretsIn('x={PS1:"{a:\'b\'}",npm_package_name:"x",SHELL:"/bin/sh"}')).toEqual([
      'PS1',
      'SHELL',
    ]);
    expect(buildSecretsIn('x="{\\"npm_package_name\\":\\"x\\",\\"LOGNAME\\":\\"x\\"}"')).toEqual(['LOGNAME']);
  });
});

describe('[H5P-003] the environment-dump search is bounded', () => {
  it('[H5P-003] parses each `{` once: an object that never closes takes linear time, not quadratic', () => {
    // Arrange: 72 KB that took about 5 s when every marker re-parsed the object from its start.
    const unclosed = `{${'HOME:"x",'.repeat(8000)}`;
    // Act
    const started = performance.now();
    const findings = buildSecretsIn(unclosed);
    // Assert
    expect(findings).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('[H5P-003] refuses a text that uses up the work budget as too complex to scan, rather than skipping it', () => {
    // Arrange: every marker would try the 64 `{` before it.
    const crowded = '{'.repeat(64) + 'HOME:1,'.repeat(20_000);
    // Act and assert
    expect(buildSecretsIn(crowded)).toEqual([TOO_COMPLEX_TO_SCAN]);
    expect(buildSecretsIn(`x={npm_package_name:"x",TOKEN_HINT:"x"};${crowded}`)).toEqual([
      'TOKEN_HINT',
      TOO_COMPLEX_TO_SCAN,
    ]);
  });
});
