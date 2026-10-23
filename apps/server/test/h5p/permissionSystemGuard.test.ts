/**
 * Tests for the startup guard that every H5P component uses HVL's permission system.
 *
 * Spec: H5P-006, SEC-003
 */
import { H5PEditor, H5PPlayer } from '@lumieducation/h5p-server';
import { afterAll, describe, expect, it } from 'vitest';
import {
  assertPermissionSystem,
  PermissionSystemMismatchError,
} from '../../src/h5p/permissionSystemGuard.js';
import { engineTestbed, removeEngineTestbeds } from '../support/engineTestbed.js';
import { RulePermissions } from '../support/rulePermissions.js';

afterAll(removeEngineTestbeds);

describe('permissionSystemGuard', () => {
  it('[H5P-006] accepts the factories’ editor and player and checks every Lumi component', async () => {
    const { editor, player, permissions } = await engineTestbed();
    const counts = assertPermissionSystem({ editor, player }, permissions);
    // contentManager, contentTypeRepository, temporaryFileManager, contentUserDataManager, packageImporter,
    // packageExporter (ours) and the content manager inside the content storer.
    expect(counts.editor).toBeGreaterThanOrEqual(6);
    expect(counts.player).toBeGreaterThanOrEqual(2);
  });

  it('[H5P-006] refuses an editor or player built without HVL’s permission system (Lumi’s allow-all default)', async () => {
    const { config, storages, permissions } = await engineTestbed();
    const s = storages;
    const plainEditor = new H5PEditor(
      s.keyValueStorage,
      config,
      s.libraryStorage,
      s.contentStorage,
      s.temporaryStorage,
    );
    const plainPlayer = new H5PPlayer(s.libraryStorage, s.contentStorage, config);
    expect(() => assertPermissionSystem({ editor: plainEditor }, permissions)).toThrow(
      PermissionSystemMismatchError,
    );
    expect(() => assertPermissionSystem({ player: plainPlayer }, permissions)).toThrow(
      PermissionSystemMismatchError,
    );
  });

  it('[SEC-003] names the one component that uses another permission system', async () => {
    const { editor, player, permissions } = await engineTestbed();
    (editor.packageImporter as unknown as { permissionSystem: unknown }).permissionSystem =
      new RulePermissions();
    expect(() => assertPermissionSystem({ editor, player }, permissions)).toThrow('editor.packageImporter');
  });

  it('[H5P-006] refuses an engine in which no permission-checking component can be found', () => {
    expect(() => assertPermissionSystem({ editor: { renamed: {} } }, new RulePermissions())).toThrow(
      PermissionSystemMismatchError,
    );
  });
});
