/**
 * Unit tests of the one Feide ID rule (D-142) and of every reader that uses it: a login's claims, the login ID a
 * Canvas launch carries, the data-subject tool's input, the configured admin list, and Feide group IDs. A Feide ID
 * written with a look-alike character or an odd space is never the same ID as the plain one.
 *
 * Spec: AUTH-002, AUTH-005, DATA-008
 */
import { describe, expect, it } from 'vitest';
import {
  readFeideIdentity,
  FEIDE_ID_CLAIM,
  FEIDE_USERID_SEC_CLAIM,
} from '../../../src/auth/feide/feideClaims.js';
import { mapFeideRoles, matchesCourseGroup } from '../../../src/auth/feide/FeideRoleMapper.js';
import { isNormalisedFeideId, normaliseFeideId } from '../../../src/auth/identity/feideId.js';
import { feideLoginFromLaunch } from '../../../src/auth/identity/linkDecision.js';
import { learnerSourceOf } from '../../../src/auth/identity/subjectSources.js';
import { loadEnv } from '../../../src/config/env.js';
import { parseDataSubject } from '../../../src/privacy/dsr/dataSubject.js';
import { envProblems, VALID_ENV } from '../../support/authEnv.js';

const CUSTOM = 'https://purl.imsglobal.org/spec/lti/claim/custom';
/** `kari@hvl.no` written so that Unicode's own tidy-up would give exactly `kari@hvl.no`. */
const LOOK_ALIKES: readonly (readonly [string, string])[] = [
  ['the Kelvin sign for k', 'Kari@hvl.no'],
  ['a no-break space in front', ' kari@hvl.no'],
  ['a line break behind', 'kari@hvl.no\n'],
  ['a byte-order mark in front', '﻿kari@hvl.no'],
  ['an ideographic space behind', 'kari@hvl.no　'],
];

describe('[AUTH-002] the Feide ID rule', () => {
  it('[AUTH-002] trims blanks and lower-cases A–Z, and refuses what is no Feide ID', () => {
    // Act + Assert
    expect(normaliseFeideId(' \tOla.Nordmann@HVL.no ')).toBe('ola.nordmann@hvl.no');
    expect(normaliseFeideId('123456@hvl.no')).toBe('123456@hvl.no');
    for (const not of [
      'ola',
      'ola@hvl',
      '@hvl.no',
      'ola@@hvl.no',
      'o la@hvl.no',
      'a,b@hvl.no',
      '',
      7,
      null,
    ]) {
      expect(normaliseFeideId(not)).toBeUndefined();
    }
    expect([isNormalisedFeideId('ola@hvl.no'), isNormalisedFeideId('Ola@hvl.no')]).toEqual([true, false]);
  });

  it.each(LOOK_ALIKES)('[AUTH-005] %s is never the plain ID', (_case, written) => {
    // Act
    const normalised = normaliseFeideId(written);
    // Assert: what Unicode's tidy-up would give, and what this rule gives
    expect(written.trim().toLowerCase()).toBe('kari@hvl.no');
    expect(normalised).not.toBe('kari@hvl.no');
  });

  it('[AUTH-002] keeps a letter outside ASCII as written, in the name part only', () => {
    // Act + Assert
    expect(normaliseFeideId('Åse@HVL.no')).toBe('Åse@hvl.no');
    expect(normaliseFeideId('åse@hvl.no')).toBe('åse@hvl.no');
    expect(normaliseFeideId('ola@hvl.nø')).toBeUndefined();
    expect(normaliseFeideId('ola@HVK.no')).toBeUndefined();
  });
});

describe('[AUTH-005] every reader of a Feide ID uses the rule', () => {
  it.each(LOOK_ALIKES)('[AUTH-002] a login whose claim has %s is not Kari’s login', (_case, written) => {
    // Act
    const primary = readFeideIdentity({ [FEIDE_ID_CLAIM]: written });
    const secondary = readFeideIdentity({ [FEIDE_USERID_SEC_CLAIM]: [`feide:${written}`] });
    // Assert
    expect(primary?.feideId).not.toBe('kari@hvl.no');
    expect(secondary?.feideId).not.toBe('kari@hvl.no');
  });

  it.each(LOOK_ALIKES)(
    '[AUTH-005] a Canvas login ID with %s does not name Kari’s Feide ID',
    (_case, written) => {
      // Act
      const named = feideLoginFromLaunch({ [CUSTOM]: { feide_login: written } }, ['author']);
      const plain = feideLoginFromLaunch({ [CUSTOM]: { feide_login: ' Kari@HVL.no\t' } }, ['author']);
      // Assert
      expect(named).not.toBe('kari@hvl.no');
      expect(plain).toBe('kari@hvl.no');
      expect(
        feideLoginFromLaunch({ [CUSTOM]: { feide_login: ' $Canvas.user.loginId' } }, ['author']),
      ).toBeUndefined();
    },
  );

  it.each(LOOK_ALIKES)(
    '[DATA-008] the data-subject tool reads %s as another ID or none',
    (_case, written) => {
      // Act
      const read = (() => {
        try {
          return parseDataSubject(JSON.stringify({ feideId: written })).feideId;
        } catch {
          return undefined;
        }
      })();
      // Assert
      expect(read).not.toBe('kari@hvl.no');
      expect(parseDataSubject(JSON.stringify({ feideId: ' Kari@HVL.no' })).feideId).toBe('kari@hvl.no');
    },
  );

  it('[AUTH-002] the admin list and the group lists fold ASCII only, so a look-alike entry is refused or kept apart', () => {
    // Act
    const env = loadEnv({ ...VALID_ENV, ADMIN_FEIDE_IDS: ' Admin@HVL.no ,Kari@hvl.no' });
    // Assert
    expect(env.ADMIN_FEIDE_IDS).toEqual(['admin@hvl.no', 'Kari@hvl.no']);
    expect(envProblems({ ...VALID_ENV, ALLOWED_FEIDE_ORGS: 'HVK.no' })[0]).toMatch(
      /^ALLOWED_FEIDE_ORGS: entry 1/,
    );
    expect(envProblems({ ...VALID_ENV, AUTHOR_COURSE_GROUPS: 'fc:fs:fs:emne:hvl.no:K101' })[0]).toMatch(
      /^AUTHOR_COURSE_GROUPS: entry 1/,
    );
  });

  it('[AUTH-002] a group ID matches a configured course group in ASCII case only', () => {
    // Act + Assert
    expect(matchesCourseGroup('fc:fs:fs:emne:hvl.no:PPK101:1', 'fc:fs:fs:emne:hvl.no:ppk101')).toBe(true);
    expect(matchesCourseGroup('fc:fs:fs:emne:hvl.no:PPK101:1', 'fc:fs:fs:emne:hvl.no:ppk101')).toBe(false);
  });

  it('[AUTH-002] the role mapper and the subject hash take only a normalised Feide ID', () => {
    // Arrange
    const policy = { allowedOrgs: ['hvl.no'], adminFeideIds: [], authorCourseGroups: [] };
    // Act + Assert
    for (const written of ['Kari@hvl.no', ' kari@hvl.no', ' kari@hvl.no']) {
      expect(() => mapFeideRoles({ feideId: written, groups: [] }, policy as never)).toThrow(
        /normalised Feide ID/,
      );
      expect(() => learnerSourceOf({ kind: 'feide', feideId: written })).toThrow(/normalised Feide ID/);
    }
  });
});
