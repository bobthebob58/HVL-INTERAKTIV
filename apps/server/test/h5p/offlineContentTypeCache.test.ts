/**
 * Tests that the editor never needs the H5P Hub while serving requests: an empty content-type cache is stored
 * once, and an existing one is left alone.
 *
 * Spec: H5P-011, H5P-002
 */
import { fsImplementations } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import {
  CONTENT_TYPE_CACHE_KEY,
  keepContentTypeCacheOffline,
} from '../../src/h5p/offlineContentTypeCache.js';
import { engineTestbed, removeEngineTestbeds } from '../support/engineTestbed.js';

afterAll(removeEngineTestbeds);

/** An HTTP client that records every request instead of sending it. */
const recorder = () => {
  const calls: unknown[] = [];
  const record = async (...args: unknown[]) => {
    calls.push(args);
    throw new Error('network request attempted');
  };
  return { calls, client: { get: record, post: record } };
};

const author = asAccountUser({
  accountId: '0192f0c4-0000-7000-8000-000000000002',
  role: 'author',
  learnerKey: 'k',
  contextId: '',
  locale: 'nn',
  hvlMember: true,
  feideAuthenticated: true,
  ltiLaunchContentIds: [],
});

describe('keepContentTypeCacheOffline', () => {
  it('[H5P-011] stores an empty Hub list when none is cached, so Lumi never asks the Hub', async () => {
    const storage = new fsImplementations.InMemoryStorage();
    await keepContentTypeCacheOffline(storage);
    expect(await storage.load(CONTENT_TYPE_CACHE_KEY)).toEqual([]);
  });

  it('[H5P-011] leaves an existing list untouched', async () => {
    const storage = new fsImplementations.InMemoryStorage();
    const cached = [{ id: 'H5P.MultiChoice', version: { major: 1, minor: 16, patch: 3 } }];
    await storage.save(CONTENT_TYPE_CACHE_KEY, cached);
    await keepContentTypeCacheOffline(storage);
    expect(await storage.load(CONTENT_TYPE_CACHE_KEY)).toEqual(cached);
  });

  it('[H5P-011] an editor whose cached list was lost rebuilds it as [] without any network request', async () => {
    const { editor, storages } = await engineTestbed();
    const hub = recorder();
    (editor.contentTypeCache as unknown as { httpClient: unknown }).httpClient = hub.client;
    await storages.keyValueStorage.save(CONTENT_TYPE_CACHE_KEY, undefined);
    await editor.getContentTypeCache(author, 'nn');
    expect(hub.calls).toEqual([]);
    expect(await storages.keyValueStorage.load(CONTENT_TYPE_CACHE_KEY)).toEqual([]);
  });

  it('[H5P-011] Content Hub metadata is refused without a network request', async () => {
    const { editor } = await engineTestbed();
    const hub = recorder();
    (editor.contentHub as unknown as { httpClient: unknown }).httpClient = hub.client;
    await expect(editor.contentHub.getMetadata('nn')).rejects.toMatchObject({
      errorId: 'hvl:hub-install-disabled',
      httpStatusCode: 403,
    });
    expect(hub.calls).toEqual([]);
  });
});
