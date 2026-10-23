/**
 * Table tests for who may change an activity's visibility, and to what.
 *
 * Spec: PROD-006, AUTH-002
 */
import { describe, expect, it } from 'vitest';
import { sharingRefusal } from '../../../src/http/api/contentSharing.js';
import type { ContentFacts } from '../../../src/h5p/permissions/ContentAccessRepository.js';

const FACTS: ContentFacts = {
  contentId: 'c1',
  ownerUserId: 'owner',
  coAuthorIds: ['co'],
  status: 'published',
  visibility: 'private',
};
const who = (userId: string, roles: ('learner' | 'author' | 'admin')[], studentAuthor = false) => ({
  userId,
  roles,
  studentAuthor,
});

describe('[PROD-006] sharing rules', () => {
  it.each([
    ['the owner shares with HVL', who('owner', ['author']), 'organisation', undefined],
    ['a co-author shares with Feide', who('co', ['author']), 'feide', undefined],
    ['an admin changes any activity', who('admin', ['learner', 'admin']), 'feide', undefined],
    ['a colleague may not', who('other', ['author']), 'organisation', 'hvl:activity-unavailable'],
    [
      'an owner who is now only a learner may not',
      who('owner', ['learner']),
      'private',
      'hvl:activity-unavailable',
    ],
    ['a student author keeps it private', who('owner', ['author'], true), 'private', undefined],
    [
      'a student author may not share with HVL',
      who('owner', ['author'], true),
      'organisation',
      'hvl:sharing-not-allowed',
    ],
    [
      'a student author may not share with Feide',
      who('owner', ['author'], true),
      'feide',
      'hvl:sharing-not-allowed',
    ],
  ] as const)('[PROD-006] %s', (_name, principal, to, expected) => {
    expect(sharingRefusal(principal, FACTS, to)).toBe(expected);
  });

  it('[PROD-006] an activity that does not exist is "not available" for everyone, admins included', () => {
    expect(sharingRefusal(who('admin', ['admin']), undefined, 'private')).toBe('hvl:activity-unavailable');
  });
});
