/**
 * Tests the validator on the ten realistic example activities (tools/h5p-libraries/examples, one per authorable
 * content type) and on the same activities as packed in the real H5P packages (D-078), with the real
 * configuration from content/laeringsdesign/hint-thresholds.yaml.
 *
 * Spec: UD-020, UD-021, PED-020
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadValidationContext } from '../../src/config/validationContext.js';
import type { ValidationInput } from '../../src/validation/types.js';
import { validateContent } from '../../src/validation/validateContent.js';
import { describeWithRealPackages, packageExamples } from '../support/realPackages.js';

const EXAMPLES_DIR = fileURLToPath(new URL('../../../../tools/h5p-libraries/examples', import.meta.url));
const context = loadValidationContext({ CAPTIONED_MEDIA_ORIGINS: [] });

interface Example {
  readonly mainLibrary: string;
  readonly title: string;
  readonly language: string;
  readonly params: unknown;
}

const examples = readdirSync(EXAMPLES_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort()
  .map((file): [string, ValidationInput] => {
    const example = JSON.parse(readFileSync(join(EXAMPLES_DIR, file), 'utf8')) as Example;
    return [
      file,
      {
        // WHY: the examples name their library as h5p.json does (`H5P.Blanks-1.14`); content.json uses a space.
        mainLibrary: example.mainLibrary.replace('-', ' '),
        params: example.params,
        metadata: { title: example.title, defaultLanguage: example.language },
        locale: 'nn',
      },
    ];
  });

/** What the examples are expected to get: warnings and hints only, listed so a change is visible in review. */
const EXPECTED_NON_ERRORS: Record<string, readonly [ruleId: string, path: string][]> = {
  'H5P.InteractiveVideo.json': [['V-VID-TRANSCRIPT', 'interactiveVideo.video.files']],
};

describe('[UD-020] the ten realistic examples', () => {
  it('[UD-020] covers the ten authorable content types', () => {
    expect(examples).toHaveLength(10);
  });

  it.each(examples)('[UD-020] %s has no error and only the expected warnings and hints', (file, input) => {
    // Act
    const findings = validateContent(input, context);
    // Assert
    expect(findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(findings.map((f) => [f.ruleId, f.path])).toEqual(EXPECTED_NON_ERRORS[file] ?? []);
  });
});

describeWithRealPackages('[UD-020] the real H5P packages', () => {
  it('[UD-020] the packed examples, completed with the libraries’ defaults, give the same findings', async () => {
    // Arrange
    const packed = await packageExamples();
    // Act
    const results = packed.map((example) => [
      example.file.replace(/\.h5p$/, '.json'),
      validateContent(
        { mainLibrary: example.library, params: example.params, metadata: example.metadata, locale: 'nn' },
        context,
      ).map((f) => [f.ruleId, f.path]),
    ]);
    // Assert
    expect(results).toHaveLength(10);
    for (const [file, findings] of results)
      expect([file, findings]).toEqual([file, EXPECTED_NON_ERRORS[String(file)] ?? []]);
  });
});
