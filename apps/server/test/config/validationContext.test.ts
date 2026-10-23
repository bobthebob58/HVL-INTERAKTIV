/**
 * Tests for loading the validator's configuration: the hint thresholds from content/laeringsdesign/hint-thresholds.yaml
 * and the captioned media origins from the environment.
 *
 * Spec: PED-020, UD-020
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { loadEnvPart } from '../../src/config/env.js';
import {
  InvalidValidationContextError,
  loadValidationContext,
  parseHintThresholds,
} from '../../src/config/validationContext.js';
import { HINT_THRESHOLD_KEYS } from '../../src/validation/hintThresholds.js';

const VALID = [
  'maxVideoMinutes: 15',
  'maxMinutesWithoutInteraction: 4',
  'maxQuestionsPerSet: 15',
  'minDecisionPoints: 2',
  'maxDecisionPoints: 4',
  'maxColumnActivities: 3',
  'maxSlideWords: 150',
  'maxChapterWordsWithoutInteraction: 1500',
].join('\n');

const problemsOf = (yaml: string): readonly string[] => {
  try {
    parseHintThresholds(yaml);
    return [];
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidValidationContextError);
    return (error as InvalidValidationContextError).problems;
  }
};

const scratch = mkdtempSync(join(tmpdir(), 'hvli-thresholds-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('[PED-020] validation context', () => {
  it('[PED-020] loads the repository file with every threshold and the captioned origins from the environment', () => {
    // Arrange
    const env = loadEnvPart(['CAPTIONED_MEDIA_ORIGINS'], {
      CAPTIONED_MEDIA_ORIGINS: 'https://hvl.cloud.panopto.eu',
    });
    // Act
    const context = loadValidationContext(env);
    // Assert
    expect(Object.keys(context.thresholds).sort()).toEqual([...HINT_THRESHOLD_KEYS].sort());
    expect(context.thresholds.maxVideoMinutes).toBeGreaterThan(0);
    expect(context.captionedMediaOrigins).toEqual(['https://hvl.cloud.panopto.eu']);
    expect(Object.isFrozen(context)).toBe(true);
  });

  it('[PED-020] accepts comments and decimal minutes', () => {
    expect(
      parseHintThresholds(
        `# comment\n${VALID.replace('maxMinutesWithoutInteraction: 4', 'maxMinutesWithoutInteraction: 4.5 # min')}`,
      ),
    ).toMatchObject({ maxMinutesWithoutInteraction: 4.5 });
  });

  it.each([
    [
      'an out-of-range value',
      VALID.replace('maxVideoMinutes: 15', 'maxVideoMinutes: 500'),
      'maxVideoMinutes',
    ],
    ['a zero', VALID.replace('maxSlideWords: 150', 'maxSlideWords: 0'), 'maxSlideWords'],
    [
      'a fraction where a count is needed',
      VALID.replace('maxQuestionsPerSet: 15', 'maxQuestionsPerSet: 7.5'),
      'maxQuestionsPerSet',
    ],
    [
      'text instead of a number',
      VALID.replace('maxColumnActivities: 3', 'maxColumnActivities: tre'),
      'maxColumnActivities',
    ],
    ['a missing key', VALID.replace('maxSlideWords: 150\n', ''), 'maxSlideWords'],
    ['a misspelt key', VALID.replace('maxVideoMinutes', 'maxVideoMinute'), 'maxVideoMinute'],
    ['a repeated key', `${VALID}\nmaxDecisionPoints: 5`, 'maxDecisionPoints'],
    ['min above max', VALID.replace('minDecisionPoints: 2', 'minDecisionPoints: 6'), 'maxDecisionPoints'],
  ])('[PED-020] stops start-up on %s, naming the key', (_, yaml, key) => {
    // Act
    const problems = problemsOf(yaml);
    // Assert
    expect(problems.join('\n')).toContain(key);
  });

  it('[PED-020] stops start-up on malformed YAML, naming the line', () => {
    expect(problemsOf(`${VALID}\nmaxSlideWords: [\n`).join('\n')).toMatch(/YAML syntax: .*line \d+/);
  });

  it('[PED-020] stops start-up on a file that is not a list of keys and values', () => {
    expect(problemsOf('- 15\n- 4\n').length).toBeGreaterThan(0);
  });

  it('[PED-020] stops start-up when the file is missing or invalid, with a message naming the file and the key', () => {
    // Arrange
    const bad = join(scratch, 'bad.yaml');
    writeFileSync(bad, VALID.replace('maxVideoMinutes: 15', 'maxVideoMinutes: -1'));
    const env = { CAPTIONED_MEDIA_ORIGINS: [] };
    // Act and assert
    expect(() => loadValidationContext(env, join(scratch, 'missing.yaml'))).toThrow(
      /missing\.yaml[\s\S]*ENOENT/,
    );
    expect(() => loadValidationContext(env, bad)).toThrow(/bad\.yaml:\n {2}- maxVideoMinutes: /);
  });
});
