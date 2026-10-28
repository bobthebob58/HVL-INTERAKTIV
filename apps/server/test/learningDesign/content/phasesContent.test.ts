/**
 * Tests for content/laeringsdesign/phases.yaml: the real file loads with every text in three languages; a renamed
 * label changes the loaded label; a missing language, an unknown key, a repeated key and a wrong phase key are
 * refused, each naming the file, the line and the key (fixtures in test/fixtures/studio-content/).
 *
 * Spec: PED-001
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASE_KEYS } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import type { ContentProblem } from '../../../src/learningDesign/content/contentProblem.js';
import { loadStudioContent } from '../../../src/learningDesign/content/loadStudioContent.js';
import {
  loadPhasesContent,
  phaseOf,
  phasesFileSchema,
} from '../../../src/learningDesign/content/phasesContent.js';
import { StudioContentError } from '../../../src/learningDesign/content/StudioContentError.js';
import { parseYamlContent } from '../../../src/learningDesign/content/yamlContentFile.js';
import { RENAMED_FORARBEID_LABEL, studioContentWithRenamedLabel } from '../../support/renamedPhaseLabels.js';

const FIXTURES = fileURLToPath(new URL('../../fixtures/studio-content/', import.meta.url));
const SHOWN = 'apps/server/test/fixtures/studio-content';
const VALID_YAML = readFileSync(join(FIXTURES, 'renamed-label', 'laeringsdesign', 'phases.yaml'), 'utf8');

const problemsOf = (root: string): readonly ContentProblem[] => {
  try {
    loadStudioContent(root);
  } catch (error) {
    if (error instanceof StudioContentError) return error.problems;
    throw error;
  }
  throw new Error(`expected ${root} to be refused`);
};

const phasesProblemsOf = (yaml: string) => {
  const result = parseYamlContent(yaml, phasesFileSchema, 'phases.yaml');
  return result.ok ? [] : result.problems;
};

describe('[PED-001] phases.yaml', () => {
  // WHY: no assertion names a label, the status or a text of the real file: ALU renames labels and confirms the
  // texts without a code change (PED-001, D-082), and a test that pinned them would turn that into one.
  it('[PED-001] loads the real file: three phases in order, every text in nn, nb and en', () => {
    // Act
    const { phases } = loadStudioContent();
    // Assert
    expect(phases.phases.map((phase) => phase.key)).toEqual([...PHASE_KEYS]);
    expect(phases.phases.map((phase) => phase.order)).toEqual([1, 2, 3]);
    for (const phase of phases.phases) {
      for (const text of [phase.label, phase.description, phase.purpose, phase.canvasPlacement]) {
        expect(Object.keys(text)).toEqual(['nn', 'nb', 'en']);
        expect(Object.values(text).every((value) => value.length > 0)).toBe(true);
      }
    }
  });

  it('[PED-001] changes the loaded label when only the content file renames it', () => {
    // Act
    const renamed = loadPhasesContent(join(FIXTURES, 'renamed-label'));
    const content = studioContentWithRenamedLabel();
    // Assert
    if (!renamed.ok) throw new Error(JSON.stringify(renamed.problems));
    expect(phaseOf(renamed.value, 'forarbeid').label).toEqual(RENAMED_FORARBEID_LABEL);
    expect(phaseOf(renamed.value, 'underveis').label.nn).toBe('Mellomarbeid');
    expect(phaseOf(content.phases, 'forarbeid').label).toEqual(RENAMED_FORARBEID_LABEL);
    expect(content.references).toEqual(loadStudioContent().references);
    expect(Object.isFrozen(content.phases)).toBe(true);
  });

  it.each([
    ['a missing language', 'missing-language', 38, 'phases[underveis].label.nb', /^the nb text is missing/],
    ['an unknown key', 'unknown-key', 19, 'phases[forarbeid].colour', /^is not a known key/],
    ['a repeated key', 'repeated-key', 59, 'phases[etterarbeid].label.nn', /^appears more than once$/],
    ['a wrong phase key', 'wrong-phase-key', 35, 'phases[undervegs].key', /^"undervegs" is not a phase key/],
  ])('[PED-001] refuses %s, naming the file, the line and the key', (_, fixture, line, key, message) => {
    // Arrange
    const file = `${SHOWN}/${fixture}/laeringsdesign/phases.yaml`;
    // Act
    const problems = problemsOf(join(FIXTURES, fixture));
    // Assert: exactly this problem in phases.yaml, whatever the other sections report about the fixture
    expect(problems.filter((problem) => problem.file === file)).toEqual([
      { file, line, key, message: expect.stringMatching(message) },
    ]);
  });

  it('[PED-001] says in the start-up error which file, line and key is wrong', () => {
    expect(() => loadStudioContent(join(FIXTURES, 'missing-language'))).toThrow(
      `${SHOWN}/missing-language/laeringsdesign/phases.yaml:38: phases[underveis].label.nb: the nb text is missing`,
    );
  });

  it('[PED-001] refuses a missing phase, a phase listed twice and an order used twice', () => {
    // Arrange
    const withoutEtterarbeid = VALID_YAML.slice(0, VALID_YAML.indexOf('  - key: etterarbeid'));
    const twice = VALID_YAML.replace('key: underveis', 'key: forarbeid');
    const sameOrder = VALID_YAML.replace('order: 3', 'order: 2');
    // Act and assert
    expect(phasesProblemsOf(withoutEtterarbeid)).toEqual([
      expect.objectContaining({ key: 'phases', message: 'the phase etterarbeid is missing' }),
    ]);
    expect(phasesProblemsOf(twice)).toContainEqual(
      expect.objectContaining({ line: 35, message: 'the phase forarbeid is listed more than once' }),
    );
    expect(phasesProblemsOf(sameOrder)).toEqual([
      expect.objectContaining({
        key: 'phases[etterarbeid].order',
        message: 'order 2 is given to two phases',
      }),
    ]);
  });

  it('[PED-001] returns the phases sorted by order, whatever the order in the file', () => {
    // Arrange
    const reordered = VALID_YAML.replace('order: 1', 'order: 9')
      .replace('order: 3', 'order: 1')
      .replace('order: 9', 'order: 3');
    // Act
    const result = parseYamlContent(reordered, phasesFileSchema, 'phases.yaml');
    // Assert
    expect(result.ok && result.value.phases.map((phase) => phase.key)).toEqual([
      'etterarbeid',
      'underveis',
      'forarbeid',
    ]);
  });

  it('[PED-001] reads the file from the content folder it is given', () => {
    // Act
    const result = loadPhasesContent(join(FIXTURES, 'renamed-label'));
    // Assert
    expect(result.ok && result.value.anchor).toMatchObject({ key: 'samling', authored: false });
    expect(Object.isFrozen(result.ok && result.value.phases)).toBe(true);
  });
});
