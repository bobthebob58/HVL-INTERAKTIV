/**
 * Tests for the ten-type rule: the constant, the content-type list and the main-library check.
 *
 * Spec: H5P-002, PROD-002
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { IHubContentTypeWithLocalInfo, IHubInfo } from '@lumieducation/h5p-server/build/src/types.js';
import {
  HVL_TOP10_CONTENT_TYPES,
  assertAuthorableMainLibrary,
  filterContentTypeCache,
} from '../../src/h5p/HvlTop10ContentTypeFilter.js';

const SPEC = new URL('../../../../docs/specs/01-h5p-core128.md', import.meta.url);

/** Machine names from the table in spec 01 §3 ("| 1 | Presentasjon | `H5P.CoursePresentation` | …"). */
function specTypes(): string[] {
  const section = readFileSync(SPEC, 'utf8').split('## 3. The ten content types')[1]?.split('\n## ')[0] ?? '';
  return [...section.matchAll(/^\| \d+ \| [^|]+\| `([\w.]+)` \|/gm)].map((m) => m[1] ?? '');
}

const entry = (machineName: string, installed = true): IHubContentTypeWithLocalInfo =>
  ({
    machineName,
    installed,
    canInstall: true,
    isUpToDate: false,
    restricted: true,
    majorVersion: 1,
    minorVersion: 0,
    patchVersion: 0,
  }) as IHubContentTypeWithLocalInfo;

const hubInfo = (libraries: IHubContentTypeWithLocalInfo[]): IHubInfo => ({
  apiVersion: { major: 1, minor: 28 },
  details: [],
  libraries,
  outdated: true,
  recentlyUsed: [],
  user: 'local',
});

describe('[H5P-002] the ten authorable content types', () => {
  it('[H5P-002] HVL_TOP10_CONTENT_TYPES equals the machine names in spec 01 §3', () => {
    expect(specTypes()).toHaveLength(10);
    expect([...HVL_TOP10_CONTENT_TYPES]).toEqual(specTypes());
    expect(HVL_TOP10_CONTENT_TYPES).not.toContain('H5P.DragQuestion');
  });

  it('[H5P-002][PROD-002] keeps only installed members of the ten, none installable or updatable', () => {
    const info = hubInfo([
      ...HVL_TOP10_CONTENT_TYPES.map((name) => entry(name)),
      entry('H5P.DragQuestion'),
      entry('H5P.TrueFalse'),
      entry('H5P.Accordion'),
      entry('H5P.Blanks', false),
    ]);
    const filtered = filterContentTypeCache(info);
    expect(filtered.libraries.map((l) => l.machineName)).toEqual([...HVL_TOP10_CONTENT_TYPES]);
    for (const type of filtered.libraries) {
      expect(type).toMatchObject({ installed: true, canInstall: false, isUpToDate: true, restricted: false });
    }
    expect(filtered.outdated).toBe(false);
  });

  it('[H5P-002] lists nothing creatable when none of the ten is installed', () => {
    const filtered = filterContentTypeCache(
      hubInfo([entry('H5P.MultiChoice', false), entry('H5P.TrueFalse')]),
    );
    expect(filtered.libraries).toEqual([]);
  });

  it('[H5P-002] refuses a main library outside the ten with 403, and an unreadable name with 400', () => {
    expect(() => assertAuthorableMainLibrary('H5P.MultiChoice 1.16')).not.toThrow();
    expect(() => assertAuthorableMainLibrary('H5P.DragQuestion 1.14')).toThrow(
      expect.objectContaining({ errorId: 'hvl:content-type-not-allowed', httpStatusCode: 403 }),
    );
    expect(() => assertAuthorableMainLibrary('H5P.TrueFalse 1.8')).toThrow(
      expect.objectContaining({ httpStatusCode: 403 }),
    );
    expect(() => assertAuthorableMainLibrary('not a library')).toThrow(
      expect.objectContaining({ errorId: 'invalid-main-library-name', httpStatusCode: 400 }),
    );
  });
});
