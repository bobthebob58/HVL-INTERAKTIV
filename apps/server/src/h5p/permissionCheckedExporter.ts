/**
 * permissionCheckedExporter — gives HvlH5PEditor a package exporter that asks HVL's permission system.
 *
 * Why: Lumi 10.0.4 builds the editor's PackageExporter from the config, which carries no permission system, so a
 *      download would never be checked (H5PEditor.js:108). This replaces it with one that asks ours for
 *      `ContentPermission.Download` (`H5P-006`).
 * Spec: H5P-006
 * Invariants:
 *   - The exporter uses the editor's own library manager, content storage and path-length limit.
 *   - It is installed in the editor's constructor, before any route can call `exportContent`.
 * Collaborators: ./HvlH5PEditor.ts (the caller), ./permissionSystemGuard.ts (checks the exporter's system).
 * Tests: apps/server/test/h5p/HvlH5PEditor.library.test.ts, apps/server/test/h5p/permissionSystemGuard.test.ts
 */
import { PackageExporter, type H5PEditor, type IPermissionSystem } from '@lumieducation/h5p-server';
import type { HvlH5pUser } from './HvlH5pUser.js';

/**
 * Replaces the editor's package exporter with one that checks Download permission.
 * @param editor - The editor, during its construction.
 * @param permissionSystem - The permission system Lumi also holds.
 * @spec H5P-006
 */
export function usePermissionCheckedExporter(
  editor: H5PEditor,
  permissionSystem: IPermissionSystem<HvlH5pUser>,
): void {
  // SECURITY: without this, Lumi's exporter has no permission system and every download is allowed.
  (editor as unknown as { packageExporter: PackageExporter }).packageExporter = new PackageExporter(
    editor.libraryManager,
    editor.contentStorage,
    { exportMaxContentPathLength: editor.config.exportMaxContentPathLength, permissionSystem },
  );
}
