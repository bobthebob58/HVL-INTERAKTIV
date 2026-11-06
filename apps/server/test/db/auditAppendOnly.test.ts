/**
 * Tests that no server code updates, deletes or empties an audit row: in production the app's database role may only
 * add and read them (D-109's amendment of 2026-11-04, apps/server/prisma/roles/02-grants.sql), so such code would
 * fail there while passing every test run as the development superuser.
 *
 * Spec: DATA-007, DATA-010
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../../src/', import.meta.url);
const MODEL_WRITE =
  /\b(?:auditEvent|authAuditEvent|libraryAuditEvent)\s*\.\s*(?:update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\b/;
const RAW_WRITE =
  /\b(?:UPDATE|DELETE\s+FROM|TRUNCATE(?:\s+TABLE)?)\s+(?:ONLY\s+)?"?(?:Auth|Library)?AuditEvent\b/i;

const sources = (): string[] =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter(
    (file) => file.endsWith('.ts') && !file.startsWith('generated/'),
  );

describe('[DATA-007] the audit trail is append-only for the app', () => {
  it('[DATA-007] the scan recognises every way of changing an audit row', () => {
    // Arrange
    const writes = [
      'tx.auditEvent.updateMany({',
      'db.authAuditEvent .delete({',
      'client.libraryAuditEvent.upsert(',
      'DELETE FROM "AuditEvent" WHERE',
      'update "AuthAuditEvent" set',
      'TRUNCATE TABLE "LibraryAuditEvent"',
    ];
    const isWrite = (line: string) => MODEL_WRITE.test(line) || RAW_WRITE.test(line);
    // Act and assert
    expect(writes.filter((line) => !isWrite(line))).toEqual([]);
    expect(['db.auditEvent.create({', 'INSERT INTO "AuditEvent"'].some(isWrite)).toBe(false);
  });

  it('[DATA-010] no server source updates, deletes or empties an audit row', () => {
    // Act
    const offending = sources().filter((file) => {
      const text = readFileSync(new URL(file, SRC), 'utf8');
      return MODEL_WRITE.test(text) || RAW_WRITE.test(text);
    });
    // Assert
    expect(sources().length).toBeGreaterThan(100);
    expect(offending).toEqual([]);
  });
});
