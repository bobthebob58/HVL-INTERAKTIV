/**
 * Integration tests for the formative defaults of every real pattern, read from what H5P stores once the activity is
 * created through the whole app on the real content types: retry and «Vis svar» on, no time limit, pass marks that
 * never end the attempts, keyboard navigation in presentations, and case-insensitive matching in fill-in tasks
 * (PROD-009, spec 04 §4; typo tolerance is each pattern's choice, D-084 amendment). The rules per content type are
 * in ./realPatternSwitches.ts; the patterns are ALU's drafts, so these tests name no pattern and read no text.
 *
 * Spec: PROD-009, PED-010
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { walkContent } from '../../../src/validation/contentWalker.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { openRealPatternBench, type PatternCreationBench } from './patternCreationBench.js';
import {
  createRealPatterns,
  creationName,
  realPatternChoices,
  type RealPatternCreation,
} from './realPatterns.js';
import { formativeViolations } from './realPatternSwitches.js';

describeWithServices('the formative defaults of every real pattern', () => {
  describeWithRealPackages('[PROD-009] every pattern of content/laeringsdesign/patterns/, as stored', () => {
    let bench: PatternCreationBench;
    let created: RealPatternCreation[] = [];
    const nodesOf = async (creation: RealPatternCreation) => {
      const { h5p, params } = await bench.tb.runtime.editor.getContent(creation.contentId, bench.author);
      const main = h5p.preloadedDependencies.find((d) => d.machineName === h5p.mainLibrary);
      return walkContent(
        `${h5p.mainLibrary} ${main?.majorVersion ?? 0}.${main?.minorVersion ?? 0}`,
        params.params,
      );
    };
    beforeAll(async () => {
      bench = await openRealPatternBench();
      created = await createRealPatterns(bench, realPatternChoices(bench.tb.studio.content.patterns), 'nn');
    }, 300_000);
    afterAll(() => bench?.close(), 60_000);

    it('[PROD-009] keeps retry and «Vis svar» on, gates nothing and sets no time limit in any created pattern', async () => {
      // Act
      const violations = await Promise.all(
        created.map(async (creation) =>
          formativeViolations(await nodesOf(creation)).map(
            (problem) => `${creationName(creation)}: ${problem}`,
          ),
        ),
      );
      // Assert
      expect(created.length).toBeGreaterThan(0);
      expect(created.filter((creation) => creation.status !== 201).map(creationName)).toEqual([]);
      expect(violations.flat()).toEqual([]);
    });

    it('[PROD-009] checks every node: each activity is walked from its own content type down into its sub-content', async () => {
      // Act
      const walked = await Promise.all(
        created.map(async (creation) => {
          const nodes = await nodesOf(creation);
          return [creationName(creation), nodes[0]?.machineName, nodes.length > 0];
        }),
      );
      // Assert
      expect(walked).toEqual(
        created.map((creation) => [creationName(creation), creation.choice.contentType, true]),
      );
    });
  });
});
