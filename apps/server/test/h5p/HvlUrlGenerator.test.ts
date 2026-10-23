/**
 * Tests for HvlUrlGenerator: the request's token, URL-encoded, on H5P's AJAX, user-data and set-finished URLs
 * only; signed content-file URLs without a token; every other URL identical to Lumi's; and the factories
 * building editor and player with it (D-058).
 *
 * Spec: H5P-007, SEC-004
 */
import { H5PConfig, UrlGenerator, type IUser } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { ContentFileGrants } from '../../src/h5p/contentFileGrants.js';
import { asAccountUser, asStateUser, type UrlToken } from '../../src/h5p/HvlH5pUser.js';
import { HvlUrlGenerator } from '../../src/h5p/HvlUrlGenerator.js';
import { parseKeyring } from '../../src/security/keys/keyring.js';
import { randomKey } from '../support/authEnv.js';
import { engineTestbed, removeEngineTestbeds } from '../support/engineTestbed.js';
import { testActor } from '../support/testActors.js';

afterAll(removeEngineTestbeds);

const NOW = new Date('2026-10-23T10:20:30Z');
const CONTENT = '0192f0c4-1111-7000-8000-000000000001';
const LTIK = 'eyJhbGciOiJSUzI1NiJ9.a+b/c=d&e#f :contentId%';
const config = new H5PConfig(undefined);
const grants = new ContentFileGrants(parseKeyring(`k1=${randomKey(1)}`));
const urls = new HvlUrlGenerator(config, grants, () => NOW);
const lumi = new UrlGenerator(config);
const learner = (urlToken?: UrlToken) => asStateUser(testActor('learner', urlToken ? { urlToken } : {}));
const tokenOf = (url: string, name: string) => new URL(url, 'https://tool.example').searchParams.get(name);

describe('[H5P-007] HvlUrlGenerator', () => {
  it('[H5P-007] adds an ltik with + / = & # and spaces URL-encoded to the AJAX, user-data and set-finished URLs', () => {
    // Arrange
    const user = learner({ name: 'ltik', value: LTIK });
    const encoded = encodeURIComponent(LTIK);
    // Act
    const ajax = urls.ajaxEndpoint(user);
    const userData = urls.contentUserData(user, 'course-1', undefined, { readonly: true });
    const finished = urls.setFinished(user);
    // Assert: Lumi's URL with the pair added; `action=` stays last because H5P appends the action name.
    expect(ajax).toBe(`/h5p/ajax?ltik=${encoded}&action=`);
    expect(userData).toBe(
      `/h5p/contentUserData/:contentId/:dataType/:subContentId?contextId=course-1&ignorePost=yes&ltik=${encoded}`,
    );
    expect(finished).toBe(`/h5p/finishedData?ltik=${encoded}`);
    for (const url of [`${ajax}libraries`, userData, finished]) expect(tokenOf(url, 'ltik')).toBe(LTIK);
    expect(userData.match(/:contentId/g)).toHaveLength(1);
  });

  it('[H5P-007] adds the portal CSRF token the same way, also for the editor’s account view', () => {
    const user = asAccountUser(testActor('author', { urlToken: { name: 'csrf', value: 'q+R/s=' } }));
    expect(urls.ajaxEndpoint(user)).toBe('/h5p/ajax?csrf=q%2BR%2Fs%3D&action=');
    expect(urls.contentUserData(user)).toBe(
      '/h5p/contentUserData/:contentId/:dataType/:subContentId?csrf=q%2BR%2Fs%3D',
    );
    expect(urls.setFinished(user)).toBe('/h5p/finishedData?csrf=q%2BR%2Fs%3D');
  });

  it('[H5P-007] adds nothing for an actor without a token, an empty token or a user it did not issue', () => {
    // Arrange
    const forged = { ...learner({ name: 'ltik', value: LTIK }) } as IUser;
    const users = [learner(), learner({ name: 'ltik', value: '' }), forged, undefined as unknown as IUser];
    // Act and assert: exactly Lumi's URLs.
    for (const user of users) {
      expect(urls.ajaxEndpoint(user)).toBe(lumi.ajaxEndpoint(user));
      expect(urls.contentUserData(user, 'c', 'u', { readonly: true })).toBe(
        lumi.contentUserData(user, 'c', 'u', { readonly: true }),
      );
      expect(urls.setFinished(user)).toBe(lumi.setFinished(user));
    }
  });

  it('[H5P-007] gives content files a signed URL with a valid grant, and no token', () => {
    // Act
    const url = urls.contentFilesUrl(CONTENT);
    // Assert
    const match = /^\/h5p\/files\/([^/]+)\/([^/]+)$/.exec(url);
    expect(match?.[2]).toBe(CONTENT);
    expect(grants.verifyGrant(match?.[1] ?? '', CONTENT, NOW).valid).toBe(true);
    expect(url).not.toMatch(/ltik|csrf|\?/);
    expect(grants.verifyGrant(match?.[1] ?? '', 'another-activity', NOW).valid).toBe(false);
  });

  it('[H5P-007] leaves every other URL exactly as Lumi builds it', () => {
    // Arrange
    const library = { machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16, patchVersion: 3 };
    // Act and assert
    expect(urls.baseUrl()).toBe(lumi.baseUrl());
    expect(urls.coreFile('js/h5p.js')).toBe(lumi.coreFile('js/h5p.js'));
    expect(urls.coreFiles()).toBe(lumi.coreFiles());
    expect(urls.downloadPackage(CONTENT)).toBe(lumi.downloadPackage(CONTENT));
    expect(urls.editorLibraryFile('scripts/h5peditor.js')).toBe(
      lumi.editorLibraryFile('scripts/h5peditor.js'),
    );
    expect(urls.editorLibraryFiles()).toBe(lumi.editorLibraryFiles());
    for (const file of ['js/main.js', '/absolute.js', 'https://cdn.example/x.js']) {
      expect(urls.libraryFile(library, file)).toBe(lumi.libraryFile(library, file));
    }
    expect(urls.parameters()).toBe(lumi.parameters());
    expect(urls.play()).toBe(lumi.play());
    expect(urls.temporaryFiles()).toBe(lumi.temporaryFiles());
    expect(urls.uniqueContentUrl(CONTENT)).toBe(lumi.uniqueContentUrl(CONTENT));
  });

  it('[H5P-007] the factories build editor and player with the HvlUrlGenerator they are given', async () => {
    // Arrange
    const { editor, player } = await engineTestbed();
    const author = asAccountUser(testActor('author', { urlToken: { name: 'csrf', value: 'tok/en' } }));
    // Act
    const model = (await editor.render(undefined as never, 'nn', author)) as {
      integration: { ajaxPath: string; editor: { ajaxPath: string; filesPath: string } };
    };
    // Assert
    const editorUrls = (editor as unknown as { urlGenerator: unknown }).urlGenerator;
    expect(editorUrls).toBeInstanceOf(HvlUrlGenerator);
    expect((player as unknown as { urlGenerator: unknown }).urlGenerator).toBe(editorUrls);
    expect(model.integration.ajaxPath).toBe('/h5p/ajax?csrf=tok%2Fen&action=');
    expect(model.integration.editor.ajaxPath).toBe('/h5p/ajax?csrf=tok%2Fen&action=');
    expect(model.integration.editor.filesPath).toBe('/h5p/temp-files');
  });

  it('[H5P-007] the player refuses every render option that would sign a file grant without the View check', async () => {
    // Arrange
    const { player } = await engineTestbed();
    const user = learner();
    const unchecked = [
      { ignoreUserPermissions: true },
      { parametersOverride: {} },
      { metadataOverride: { title: 'x' } as never },
    ];
    // Act and assert
    for (const options of unchecked) {
      await expect(player.render(CONTENT, user, 'nn', options), Object.keys(options)[0]).rejects.toThrow(
        /H5PPlayer\.render refuses/,
      );
    }
    await expect(player.render(CONTENT, user, 'nn', { ignoreUserPermissions: false })).rejects.toMatchObject({
      httpStatusCode: 404,
    });
  });

  it('upstream pin: Lumi’s queryParamGenerator writes a token unencoded into the AJAX URL, encoded into user data', () => {
    // WHY: D-058 rests on this; if a Lumi release encodes consistently, its generator can replace ours.
    const generator = new UrlGenerator(config, {
      protectAjax: true,
      protectContentUserData: true,
      protectSetFinished: true,
      queryParamGenerator: () => ({ name: 'ltik', value: 'a+b' }),
    });
    expect(generator.ajaxEndpoint(learner())).toBe('/h5p/ajax?ltik=a+b&action=');
    expect(generator.setFinished(learner())).toBe('/h5p/finishedData?ltik=a+b');
    expect(generator.contentUserData(learner())).toMatch(/\?ltik=a%2Bb$/);
  });
});
