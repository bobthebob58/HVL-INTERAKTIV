/**
 * Tests for the seccomp profile's rules: the real profile is Docker's default with the one rule Chromium's sandbox
 * needs, and a copy with a changed byte, a second added rule, a moved rule, an open default, a missing namespace
 * call, `io_uring` or an unconditional `socket` is refused.
 *
 * Spec: NFR-007, MAPPE-004
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ADDED_RULE, SECCOMP_FILE, seccompProblems } from '../seccompRules.mjs';

const SECCOMP = readFileSync(fileURLToPath(new URL(`../../../${SECCOMP_FILE}`, import.meta.url)));
const TEXT = SECCOMP.toString('utf8');
const HASH = /^deploy\/seccomp\/chromium-sandbox\.seccomp: SHA-256 [0-9a-f]{64}, expected 42127de9/;
const NOT_DEFAULT = `${SECCOMP_FILE}: without the added rule it must be Docker's default profile, byte for byte`;
const NOT_FIRST = `${SECCOMP_FILE}: the added rule must stand once, first among the rules, as written`;

/** The problems of a changed copy, without the hash line every changed copy gets. */
const problemsOf = (text) => {
  const [hash, ...rest] = seccompProblems(Buffer.from(text, 'utf8'));
  expect(hash).toMatch(HASH);
  return rest;
};

/** The profile with one more rule that allows `names` (with `args` when given), after the added rule. */
const withRule = (names, args) => {
  const profile = JSON.parse(TEXT);
  profile.syscalls.push({ names, action: 'SCMP_ACT_ALLOW', ...(args ? { args } : {}) });
  return JSON.stringify(profile);
};

describe('[MAPPE-004] the seccomp profile is Docker’s default plus one rule', () => {
  it('[MAPPE-004] the real profile passes: the default with the namespace calls Chromium’s sandbox needs', () => {
    // Act
    const profile = JSON.parse(TEXT);
    // Assert
    expect(seccompProblems(SECCOMP)).toEqual([]);
    expect(profile.syscalls[0]).toMatchObject({
      names: ['clone', 'setns', 'unshare'],
      action: 'SCMP_ACT_ALLOW',
    });
    expect(profile.syscalls.filter((rule) => rule.comment?.startsWith('HVL Interaktiv'))).toHaveLength(1);
  });

  it('[NFR-007] a byte changed in Docker’s part, or a rule changed, moved or added twice, is refused', () => {
    // Arrange
    const changedDefault = TEXT.replace('"SCMP_ARCH_X86_64"', '"SCMP_ARCH_x86_64"');
    const changedRule = TEXT.replace('"unshare"\n', '"unshare",\n\t\t\t\t"mount"\n');
    const moved = TEXT.replace(ADDED_RULE, '').replace(
      '\t"syscalls": [\n\t\t{\n',
      `\t"syscalls": [\n\t\t{\n${ADDED_RULE}`,
    );
    const twice = TEXT.replace(ADDED_RULE, ADDED_RULE + ADDED_RULE);
    // Act and assert
    expect(changedDefault).not.toBe(TEXT);
    expect(problemsOf(changedDefault)).toEqual([NOT_DEFAULT]);
    expect(problemsOf(changedRule)).toContain(NOT_FIRST);
    expect(() => seccompProblems(Buffer.from(moved, 'utf8'))).toThrow(SyntaxError);
    expect(problemsOf(twice)).toEqual([NOT_FIRST]);
  });

  it('[MAPPE-004] an open default or a missing namespace call is refused', () => {
    // Arrange
    const open = TEXT.replace('"defaultAction": "SCMP_ACT_ERRNO"', '"defaultAction": "SCMP_ACT_ALLOW"');
    const narrowed = TEXT.replace('\t\t\t\t"setns",\n', '');
    // Act and assert
    expect(problemsOf(open)).toEqual([NOT_DEFAULT, `${SECCOMP_FILE}: the default must deny`]);
    expect(problemsOf(narrowed)).toEqual([
      NOT_FIRST,
      `${SECCOMP_FILE}: setns must be allowed for Chromium's sandbox`,
    ]);
  });

  it('[NFR-007] io_uring and a socket call of any address family do not come back', () => {
    // Arrange: what the profile before D-144 allowed beyond Docker's default
    const uring = withRule(['io_uring_setup', 'io_uring_enter']);
    const anySocket = withRule(['socket']);
    const byFamily = withRule(['socket'], [{ index: 0, value: 16, op: 'SCMP_CMP_EQ' }]);
    // Act and assert
    expect(problemsOf(uring)).toEqual([
      NOT_FIRST,
      `${SECCOMP_FILE}: io_uring_setup must not be allowed`,
      `${SECCOMP_FILE}: io_uring_enter must not be allowed`,
    ]);
    expect(problemsOf(anySocket)).toEqual([
      NOT_FIRST,
      `${SECCOMP_FILE}: socket must be allowed only by address family, as in Docker's default`,
    ]);
    expect(problemsOf(byFamily)).toEqual([NOT_FIRST]);
  });
});
