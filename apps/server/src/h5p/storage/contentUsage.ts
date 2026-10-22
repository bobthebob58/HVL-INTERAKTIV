/**
 * contentUsage — counts how many activities use a given H5P library, as main library or as a dependency.
 *
 * Why: H5P asks this before an admin deletes or replaces a library. Lumi's file storage answers it by
 *      reading every activity; one SQL query over the stored metadata does the same without loading them.
 * Spec: H5P-004
 * Invariants: same rule as Lumi's `hasDependencyOn`: a match in preloaded, editor or dynamic dependencies
 *   (machine name, major and minor version); `asMainLibrary` when the activity's main library has that name.
 * Collaborators: ./PrismaContentStorage.ts, ../../infra/prismaClient.ts.
 * Tests: apps/server/test/h5p/contentStorage.int.test.ts
 */
import type { ILibraryName } from '@lumieducation/h5p-server';
import type { Database } from '../../infra/prismaClient.js';

/**
 * Counts library usage.
 * @param db - Database client.
 * @param library - Machine name and version to look for (patch version is ignored, as in H5P).
 * @returns Counts as H5P expects them.
 */
export async function countLibraryUsage(
  db: Database,
  library: ILibraryName,
): Promise<{ asDependency: number; asMainLibrary: number }> {
  const needle = JSON.stringify([
    {
      machineName: library.machineName,
      majorVersion: library.majorVersion,
      minorVersion: library.minorVersion,
    },
  ]);
  const rows = await db.$queryRaw<{ main: boolean; n: number }[]>`
    SELECT ("mainLibrary" = ${library.machineName}) AS main, count(*)::int AS n
    FROM "H5PContent"
    WHERE metadata->'preloadedDependencies' @> ${needle}::jsonb
       OR metadata->'editorDependencies' @> ${needle}::jsonb
       OR metadata->'dynamicDependencies' @> ${needle}::jsonb
    GROUP BY 1`;
  return {
    asMainLibrary: rows.find((r) => r.main)?.n ?? 0,
    asDependency: rows.find((r) => !r.main)?.n ?? 0,
  };
}
