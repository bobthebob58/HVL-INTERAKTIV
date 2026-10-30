/**
 * Unit tests for the activity version on player pages: the learner-state URL carries it, the version is read
 * before Lumi renders, a refused render reveals nothing, and a state write's version is read strictly.
 *
 * Spec: PROD-013, H5P-005
 */
import type { H5PPlayer, IPlayerModel } from '@lumieducation/h5p-server';
import { describe, expect, it } from 'vitest';
import {
  contentVersionOf,
  stampContentVersion,
  withContentVersion,
} from '../../../src/learningDesign/safeEditing/contentVersionOnPages.js';

const model = (contentUserData: string): IPlayerModel =>
  ({ integration: { ajax: { contentUserData, setFinished: '/f' } } }) as unknown as IPlayerModel;

describe('[PROD-013] the version in the learner-state URL', () => {
  it('[PROD-013] is added after the token query, or as the first query parameter', () => {
    const withToken = withContentVersion(
      model('/h5p/contentUserData/:contentId/:dataType/:subContentId?csrf=x'),
      3,
    );
    const without = withContentVersion(model('/h5p/contentUserData/:contentId/:dataType/:subContentId'), 12);
    expect(withToken.integration.ajax.contentUserData).toBe(
      '/h5p/contentUserData/:contentId/:dataType/:subContentId?csrf=x&contentVersion=3',
    );
    expect(without.integration.ajax.contentUserData).toMatch(/:subContentId\?contentVersion=12$/);
    expect(withToken.integration.ajax.setFinished).toBe('/f');
  });

  it('[PROD-013] is read before the render, and a render that fails passes its error on', async () => {
    // Arrange
    const order: string[] = [];
    const player = {
      render: async (id: string) => {
        order.push('render');
        if (id === 'refused') throw Object.assign(new Error('no'), { httpStatusCode: 403 });
        return model('/s?ltik=l');
      },
    } as unknown as H5PPlayer;
    const versions = {
      currentVersion: async () => {
        order.push('version');
        return 7;
      },
    };
    stampContentVersion(player, versions);
    // Act
    const rendered = (await player.render('a', {} as never, 'nn', {})) as IPlayerModel;
    const refused = player.render('refused', {} as never, 'nn', {});
    // Assert
    expect(rendered.integration.ajax.contentUserData).toBe('/s?ltik=l&contentVersion=7');
    await expect(refused).rejects.toMatchObject({ httpStatusCode: 403 });
    expect(order.slice(0, 2)).toEqual(['version', 'render']);
  });

  it.each([
    [undefined, undefined],
    ['1', 1],
    ['123456789', 123456789],
  ])('[PROD-013] a state write with contentVersion=%s reads as %s', (value, version) => {
    expect(contentVersionOf(value)).toBe(version);
  });

  it.each([['0'], ['01'], ['-1'], ['1.5'], ['1234567890'], [['1', '2']], ['abc']])(
    '[PROD-013] a state write with contentVersion=%j is refused with 400',
    (value) => {
      expect(() => contentVersionOf(value)).toThrow(expect.objectContaining({ status: 400 }));
    },
  );
});
