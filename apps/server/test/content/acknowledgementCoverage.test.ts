/**
 * Unit tests for the acknowledgement rules of the publish gate: what covers an error, for how long, and when a publish
 * request is invalid, blocked or allowed.
 *
 * Spec: PROD-003, UD-022
 */
import {
  findingWithAcknowledgementSchema,
  type ApiFinding,
  type FindingWithAcknowledgement,
} from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  ACKNOWLEDGEMENT_LIFETIME_MS,
  decidePublish,
  hasUncoveredError,
  stillHolds,
  withAcknowledgements,
  type StoredAcknowledgement,
} from '../../src/content/acknowledgementCoverage.js';
import type { Finding } from '../../src/validation/types.js';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-23T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const finding = (ruleId: string, severity: Finding['severity'], path = 'media'): Finding => ({
  ruleId,
  severity,
  requirement: ruleId.startsWith('V-') ? 'UD-021' : 'PED-020',
  path,
  message: `${ruleId} at ${path}`,
});
const stored = (
  ruleId: string,
  at: Date,
  path = 'media',
  reason = 'Kjem i Panopto.',
): StoredAcknowledgement => ({
  ruleId,
  path,
  reason,
  at,
});

describe('[UD-022] acknowledgements', () => {
  it('[PROD-003] holds for less than 14 days and is asked for again after that', () => {
    expect(ACKNOWLEDGEMENT_LIFETIME_MS).toBe(14 * DAY);
    expect(stillHolds({ at: ago(14 * DAY - 1) }, now)).toBe(true);
    expect(stillHolds({ at: ago(14 * DAY) }, now)).toBe(false);
  });

  it('[UD-022] covers only an error with the same rule and path, with the newest reason and its expiry', () => {
    // Arrange
    const findings = [
      finding('V-IMG-ALT', 'error'),
      finding('V-IMG-ALT', 'error', 'other'),
      finding('V-LANG', 'warning'),
    ];
    const acks = [
      stored('V-IMG-ALT', ago(3 * DAY), 'media', 'Old.'),
      stored('V-IMG-ALT', ago(DAY), 'media', 'New.'),
      stored('V-LANG', ago(DAY)),
    ];
    // Act
    const covered = withAcknowledgements(findings, acks, now);
    // Assert
    expect(covered[0]?.acknowledgement).toEqual({
      reason: 'New.',
      at: ago(DAY).toISOString(),
      expiresAt: new Date(ago(DAY).getTime() + 14 * DAY).toISOString(),
    });
    expect(covered[1]?.acknowledgement).toBeNull();
    expect(covered[2]?.acknowledgement).toBeNull();
    expect(covered.map((f) => f.message)).toEqual(findings.map((f) => f.message));
  });

  it('[PROD-003] warnings and hints never block, with or without acknowledgements', () => {
    // Act
    const decision = decidePublish([finding('V-LANG', 'warning'), finding('PED-H05', 'hint')], [], [], now);
    // Assert
    expect(decision).toEqual({ kind: 'allowed', acknowledgements: [] });
    expect(hasUncoveredError(withAcknowledgements([finding('V-LANG', 'warning')], [], now))).toBe(false);
  });

  it('[PROD-003] an error blocks until it has a reason, stored and recent or in the request', () => {
    // Arrange
    const errors = [finding('V-IMG-ALT', 'error'), finding('V-VID-CAPTIONS', 'error', '')];
    const reason = { ruleId: 'V-VID-CAPTIONS', path: '', reason: 'Teksting kjem.' };
    // Act
    const none = decidePublish(errors, [], [], now);
    const half = decidePublish(errors, [], [reason], now);
    const expired = decidePublish(errors, [stored('V-IMG-ALT', ago(15 * DAY))], [reason], now);
    const both = decidePublish(errors, [stored('V-IMG-ALT', ago(13 * DAY))], [reason], now);
    // Assert
    expect(none.kind).toBe('blocked');
    expect(half.kind).toBe('blocked');
    expect(expired.kind).toBe('blocked');
    expect(both).toEqual({ kind: 'allowed', acknowledgements: [reason] });
  });

  it('[PROD-003] a reason for something that is not a current error makes the request invalid', () => {
    // Arrange
    const findings = [
      finding('V-IMG-ALT', 'error'),
      finding('V-LANG', 'warning', 'metadata.defaultLanguage'),
    ];
    // Act and assert
    for (const ack of [
      { ruleId: 'V-IMG-ALT', path: 'elsewhere', reason: 'x' },
      { ruleId: 'V-LANG', path: 'metadata.defaultLanguage', reason: 'x' },
      { ruleId: 'V-UNKNOWN', path: 'media', reason: 'x' },
    ]) {
      expect(decidePublish(findings, [], [ack], now), JSON.stringify(ack)).toEqual({ kind: 'invalid' });
    }
  });

  it('[UD-022] two reasons for the same error are stored once, the first one', () => {
    // Arrange
    const first = { ruleId: 'V-IMG-ALT', path: 'media', reason: 'First.' };
    // Act
    const decision = decidePublish(
      [finding('V-IMG-ALT', 'error')],
      [],
      [first, { ...first, reason: 'Again.' }],
      now,
    );
    // Assert
    expect(decision).toEqual({ kind: 'allowed', acknowledgements: [first] });
  });

  it('[UD-022] the server’s findings have exactly the contract’s shape, in both directions', () => {
    // Arrange: assignments the compiler checks, so the two definitions cannot drift apart
    const covered: FindingWithAcknowledgement[] = withAcknowledgements(
      [finding('V-IMG-ALT', 'error')],
      [],
      now,
    );
    const fromContract: Finding = covered[0] as ApiFinding;
    // Act
    const parsed = findingWithAcknowledgementSchema.parse(covered[0]);
    // Assert
    expect(parsed).toEqual(covered[0]);
    expect(fromContract.ruleId).toBe('V-IMG-ALT');
  });
});
