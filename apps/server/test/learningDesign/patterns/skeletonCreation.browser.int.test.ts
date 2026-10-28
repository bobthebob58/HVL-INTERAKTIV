/**
 * Probe P1 (S5): activities created on the server from pattern skeletons, on the real content types (D-078). Each
 * skeleton is completed with Nynorsk semantics defaults and fresh `subContentId`s, saved through HvlH5PEditor as an
 * author, validated, played in Chromium and saved once, unchanged, in H5P's editor (D-084, D-085). The tests pin
 * what was found: the versions offered, what a save needs, what the editor still adds, which defaults stay English,
 * and what a learner sees where a video or an image is missing.
 *
 * Spec: PED-010, PROD-001, H5P-008
 */
import type { IContentMetadata, IUser } from '@lumieducation/h5p-server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { activityLanguage } from '../../../src/validation/activityLanguage.js';
import { describeWithBrowser } from '../../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { diffParams, sameText, subContentIdsOf } from './skeletonCreationDiff.js';
import * as expected from './skeletonCreationExpected.js';
import {
  completeSkeleton,
  createFromSkeleton,
  editorSaveReport,
  storedFindings,
  type Created,
} from './skeletonCreationFlow.js';
import { saveUnchangedInEditor, viewInPlayer } from './skeletonCreationPages.js';
import { PROBE_SKELETONS, UV_CASE } from './skeletonCreationSkeletons.js';
import { withSemanticDefaults } from '../../../src/learningDesign/patterns/semanticDefaults.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const versionOf = (l: { majorVersion: number; minorVersion: number; patchVersion: number }) =>
  `${l.majorVersion}.${l.minorVersion}.${l.patchVersion}`;
const sorted = (table: Readonly<Record<string, readonly string[]>>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(table).map(([key, list]) => [key, [...list].sort()]));

describeWithServices('creating activities from pattern skeletons (probe P1)', () => {
  describeWithRealPackages('[PED-010] skeletons on the real content types', () => {
    let tb: HttpTestbed;
    let author: TestActor;
    let user: IUser;
    let base: string;
    const created: Created[] = [];
    const byPattern = <T>(value: (c: Created) => T): Record<string, T> =>
      Object.fromEntries(created.map((c) => [c.skeleton.pattern, value(c)]));
    const stored = (id: string) => tb.runtime.editor.getContent(id, user);
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      user = asAccountUser(author.actor);
      for (const skeleton of PROBE_SKELETONS)
        created.push(await createFromSkeleton(tb.runtime.editor, skeleton, user));
      base = await listenOnLoopback(tb.app);
    }, 180_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });

    it('[PED-010] the editor offers each type in its newest installed minor, the version a skeleton names', async () => {
      // Act
      const cache = await tb.runtime.editor.getContentTypeCache(user, 'nn');
      const installed = await tb.runtime.editor.libraryManager.listInstalledLibraries();
      // Assert
      expect(Object.fromEntries(cache.libraries.map((l) => [l.machineName, versionOf(l)]))).toEqual(
        expected.OFFERED_VERSIONS,
      );
      for (const [name, version] of Object.entries(expected.INSTALLED_NOT_OFFERED)) {
        expect((installed[name] ?? []).map(versionOf)).toContain(version);
      }
      const named = PROBE_SKELETONS.map((s) => s.library.split(' '));
      expect(named.every(([name, v]) => expected.OFFERED_VERSIONS[name ?? '']?.startsWith(`${v}.`))).toBe(
        true,
      );
    });

    it('[PROD-001] Lumi saves with only a title, and an activity saved without a language is English', async () => {
      // Arrange
      const params = await completeSkeleton(tb.runtime.editor, UV_CASE, 'nn');
      const save = (metadata: object) =>
        tb.runtime.editor.saveOrUpdateContent(
          undefined,
          structuredClone(params),
          metadata as IContentMetadata,
          UV_CASE.library,
          user,
        );
      // Act and assert
      await expect(save({})).rejects.toThrow('Metadata does not conform to schema.');
      const { h5p } = await stored(await save({ title: 'uv-case' }));
      expect(h5p).toMatchObject({ title: 'uv-case', language: 'en', mainLibrary: 'H5P.BranchingScenario' });
      expect([h5p.defaultLanguage, h5p.license, activityLanguage(h5p)]).toEqual([undefined, undefined, 'en']);
    });

    it('[PED-010] each skeleton is stored as created, with Nynorsk defaults and unique fresh subContentIds', async () => {
      // Act
      const diffs = await Promise.all(
        created.map(async (c) => diffParams(c.params, (await stored(c.id)).params.params)),
      );
      const ids = created.flatMap((c) => Object.values(subContentIdsOf(c.params)));
      // Assert: Lumi's sanitiser only rewrites the style attribute of InteractiveBook's default cover text
      const same = { added: [], removed: [], changed: [] };
      expect(diffs).toEqual([same, same, { ...same, changed: ['bookCover.coverDescription'] }, same]);
      const counts = byPattern((c) => Object.keys(subContentIdsOf(c.params)).length);
      expect(counts).toEqual(expected.SUB_CONTENT_ID_COUNTS);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.every((id) => UUID.test(id))).toBe(true);
      const scenario = created[1]?.params.branchingScenario as { l10n?: { startScreenButtonText?: string } };
      expect(scenario.l10n?.startScreenButtonText).toBe('Start kurset');
      expect((await stored(created[0]?.id ?? '')).h5p.defaultLanguage).toBe('nn');
    });

    it('[PROD-001] the validator finds nothing but placeholders, also where the video or the image is missing', async () => {
      // Act
      const found = await Promise.all(created.map((c) => storedFindings(tb.runtime.editor, c, user)));
      // Assert
      expect(found).toEqual(created.map(() => []));
    });

    it("[H5P-008] some learner-facing Nynorsk defaults are the libraries' English text", async () => {
      // Act
      const english = await Promise.all(
        created.map(async ({ skeleton: s, params }) => {
          const inEnglish = await withSemanticDefaults(
            s.params,
            s.library,
            tb.runtime.editor.libraryManager,
            'en',
          );
          return [s.pattern, sameText(params, inEnglish, s.params)] as const;
        }),
      );
      // Assert
      expect(Object.fromEntries(english)).toEqual(sorted(expected.ENGLISH_IN_NYNORSK));
    });

    describeWithBrowser('[PROD-001] the created activities in the player and the editor', (browser) => {
      it('[PED-010] uv-case and uv-module play; without their media fa-video and fa-hotspots show only an English error', async () => {
        // Act
        const views = await Promise.all(created.map((c) => viewInPlayer(browser(), base, author, c.id)));
        const [video, branching, book, hotspots] = views;
        // Assert
        expect(views.map((v) => [v.status, v.problems, v.refusedFrames])).toEqual(
          views.map(() => [200, [], []]),
        );
        expect(video?.tree).toBe('- text: Video source is missing.');
        // WHY: `.*` after the button: an icon-font glyph follows its name.
        expect(hotspots?.tree).toMatch(
          /^- button "Full skjerm":.*\n- text: Missing required background image$/,
        );
        // WHY: the button's name ends with an icon-font glyph (U+F178).
        expect(branching?.tree).toMatch(/- button "Start kurset[^"]*"/);
        // UD-021: without a start image, BranchingScenario shows its own default pictures, which have no alt text.
        expect(branching?.imagesWithoutAlt.map((src) => src.split('/').pop())).toEqual([
          'start-screen-default.jpg',
          'end-screen-default.jpg',
        ]);
        // WHY: the book shows sub-content titles to learners: a chapter's as its heading, a task's in the contents.
        for (const text of ['Side 1 av 4', '"⟦Tittel på kapittel 1⟧" [level=1]', ' Kapittel 1: sjekk"'])
          expect(book?.tree).toContain(text);
      }, 120_000);

      it('[PROD-001] the editor saves each activity unchanged without an error, keeps its subContentIds, language and licence, and adds only defaults', async () => {
        const reports: Record<string, unknown> = {};
        for (const c of created) {
          // Act
          const before = (await stored(c.id)).params.params;
          const save = await saveUnchangedInEditor(browser(), base, author, c.id);
          reports[c.skeleton.pattern] = {
            ...editorSaveReport(save, before, await stored(c.id)),
            findings: await storedFindings(tb.runtime.editor, c, user),
          };
        }
        // Assert
        const frames: Record<string, string[]> = { 'uv-case': ['https://documentation.h5p.com/'] };
        const fields = sorted(expected.EDITOR_ADDED_FIELDS);
        expect(reports).toEqual(
          byPattern(({ skeleton: { pattern } }) => ({
            save: [200, 'Lagra.', [], frames[pattern] ?? []],
            sameIds: true,
            added: fields[pattern],
            removedOrChanged: [],
            findings: [],
            // WHY: the editor keeps the created language and licence, and copies the title to extraTitle.
            metadata: ['nn', 'en', 'U', pattern],
          })),
        );
        // WHY: IV's text-track list has `defaultNum: 1`, so the editor adds one track without a file, in English.
        const video = (await stored(created[0]?.id ?? '')).params.params as {
          interactiveVideo: { video: { textTracks: unknown } };
        };
        expect(video.interactiveVideo.video.textTracks).toEqual({
          videoTrack: [{ kind: 'subtitles', label: 'Teksting', srcLang: 'en' }],
        });
      }, 300_000);
    });
  });
});
