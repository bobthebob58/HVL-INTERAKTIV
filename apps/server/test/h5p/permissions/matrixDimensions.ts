/**
 * matrixDimensions — how the H5P-006 matrix tests build their rows: every combination of the dimensions' values.
 *
 * Why: the content, user-data and general/temporary-file matrices enumerate the same roles and views and need the
 *      same cartesian product and enum reading; one definition keeps the three tables built alike.
 * Spec: H5P-006
 * Tests: used by ./contentMatrix.test.ts, ./userDataMatrix.test.ts and ./generalAndTemporary.test.ts.
 */
import type { H5pRole, H5pUserView } from '../../../src/h5p/HvlH5pUser.js';

/** Every role of the matrix. */
export const ROLES: H5pRole[] = ['learner', 'author', 'admin'];
/** Both views of a person: the account and the learner state. */
export const VIEWS: H5pUserView[] = ['account', 'state'];

/** Every combination of the dimensions' values, one object per cell, the first dimension varying slowest. */
export const product = <T extends Record<string, readonly unknown[]>>(
  dims: T,
): { [K in keyof T]: T[K][number] }[] =>
  Object.entries(dims).reduce<Record<string, unknown>[]>(
    (rows, [key, values]) => rows.flatMap((row) => values.map((value) => ({ ...row, [key]: value }))),
    [{}],
  ) as { [K in keyof T]: T[K][number] }[];

/** The members of a numeric enum such as Lumi's permission enums (without the reverse-mapped names). */
export const numeric = <E extends object>(e: E): E[keyof E][] =>
  Object.values(e).filter((v) => typeof v === 'number') as E[keyof E][];
