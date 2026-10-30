/**
 * Integration tests for what the validator says about every real pattern right after it is created, through the whole
 * app on the real content types, in Nynorsk, Bokmål and English: no error except V-PLACEHOLDER, which flags only
 * fields that still hold guidance and the media an Interactive Video or Image Hotspots needs, and no PED-H07 hint
 * (PROD-001: "zero errors apart from placeholders that are deliberately flagged"; D-086; PROD-009).
 *
 * Spec: PROD-001, PED-010, PROD-009
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { plainTextOf } from '../../../src/validation/richText.js';
import type { Finding } from '../../../src/validation/types.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { openRealPatternBench, storedFindings, type PatternCreationBench } from './patternCreationBench.js';
import {
  createRealPatterns,
  creationName,
  realPatternChoices,
  type RealPatternCreation,
} from './realPatterns.js';

const LANGUAGES = ['nn', 'nb', 'en'] as const;

/** The media slot V-PLACEHOLDER reports as missing, per content type that has one (D-086 amendment). */
const MEDIA_SLOT: Readonly<Record<string, string>> = {
  'H5P.InteractiveVideo': 'interactiveVideo.video.files',
  'H5P.ImageHotspots': 'image',
};

/** The value at a finding's path (`a.b[2].c`) in the stored parameters, or the title for `metadata.title`. */
function valueAt(params: unknown, title: string, path: string): unknown {
  if (path === 'metadata.title') return title;
  const keys = path.split(/\.|\[(\d+)\]/).filter((key) => key !== undefined && key !== '');
  return keys.reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], params);
}

interface Checked {
  readonly name: string;
  readonly contentType: string;
  readonly findings: readonly Finding[];
  readonly params: unknown;
  readonly title: string;
}

describeWithServices('what the validator says about every real pattern', () => {
  describeWithRealPackages(
    '[PROD-001] every pattern of content/laeringsdesign/patterns/, just created',
    () => {
      let bench: PatternCreationBench;
      const checked: Checked[] = [];
      const check = async (creation: RealPatternCreation): Promise<Checked> => {
        const { params, h5p } = await bench.tb.runtime.editor.getContent(creation.contentId, bench.author);
        return {
          name: creationName(creation),
          contentType: creation.choice.contentType,
          findings: await storedFindings(bench, creation.contentId),
          params: params.params,
          title: h5p.title,
        };
      };
      beforeAll(async () => {
        bench = await openRealPatternBench();
        const choices = realPatternChoices(bench.tb.studio.content.patterns);
        for (const language of LANGUAGES)
          for (const creation of await createRealPatterns(bench, choices, language))
            checked.push(await check(creation));
      }, 300_000);
      afterAll(() => bench?.close(), 60_000);

      it('[PROD-001] reports no error but V-PLACEHOLDER on any pattern, in nn, nb and en, and V-PLACEHOLDER on each', () => {
        // Act
        const errors = checked.map(({ name, findings }) => ({
          name,
          others: findings
            .filter((f) => f.severity === 'error' && f.ruleId !== 'V-PLACEHOLDER')
            .map((f) => f.ruleId),
          placeholders: findings.filter((f) => f.ruleId === 'V-PLACEHOLDER').length > 0,
        }));
        // Assert
        expect(checked.length).toBeGreaterThan(0);
        expect(errors).toEqual(checked.map(({ name }) => ({ name, others: [], placeholders: true })));
      });

      it('[PROD-001] flags with V-PLACEHOLDER only fields that still hold guidance ⟦…⟧, and the missing media slot', () => {
        // Act
        const unexplained = checked.flatMap(({ name, contentType, findings, params, title }) =>
          findings
            .filter((f) => f.ruleId === 'V-PLACEHOLDER')
            .filter((f) => f.path !== MEDIA_SLOT[contentType])
            .filter((f) => {
              const value = valueAt(params, title, f.path);
              return typeof value !== 'string' || !/[⟦⟧]/.test(plainTextOf(value));
            })
            .map((f) => `${name}: ${f.path}`),
        );
        // Assert
        expect(unexplained).toEqual([]);
      });

      it('[PROD-001] reports the missing video of every Interactive Video and the missing image of every Image Hotspots', () => {
        // Act
        const media = checked
          .filter(({ contentType }) => MEDIA_SLOT[contentType] !== undefined)
          .map(({ name, contentType, findings }) => [
            name,
            findings.some((f) => f.ruleId === 'V-PLACEHOLDER' && f.path === MEDIA_SLOT[contentType]),
          ]);
        // Assert: both kinds were created, so the check cannot pass on an empty list
        expect(
          new Set(checked.map(({ contentType }) => contentType).filter((type) => type in MEDIA_SLOT)),
        ).toEqual(new Set(Object.keys(MEDIA_SLOT)));
        expect(media.filter(([, reported]) => !reported)).toEqual([]);
      });

      it('[PROD-009] gives no PED-H07 hint on any created pattern: retry and «Vis svar» stay on', () => {
        // Act
        const hints = checked.flatMap(({ name, findings }) =>
          findings.filter((f) => f.ruleId === 'PED-H07').map((f) => `${name}: ${f.path}`),
        );
        // Assert
        expect(hints).toEqual([]);
      });
    },
  );
});
