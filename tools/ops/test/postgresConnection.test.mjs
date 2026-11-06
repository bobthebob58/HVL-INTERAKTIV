/**
 * postgresConnection.test — the backup CLI's connection rules: libpq's environment from `DATABASE_URL`, TLS for a
 * database or store on another host, the S3 settings, PostgreSQL's version lines, safe tool messages and arguments.
 * Spec: NFR-002, DATA-004, DATA-009
 */
import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../backupCli.mjs';
import { s3Settings } from '../bucketBackup.mjs';
import { BackupConfigError, libpqEnv, serverMajor, toolEnv, toolMajor } from '../postgresConnection.mjs';
import { TABLE_NAME } from '../postgresDump.mjs';
import { toolFailure } from '../toolProcess.mjs';

const S3 = { S3_ACCESS_KEY_ID: 'id', S3_SECRET_ACCESS_KEY: 'secret' };

describe('the database connection of a backup', () => {
  it('[NFR-002] gives libpq the URL as PG* values, with the password only in the environment', () => {
    // Act
    const { env, database, loopback } = libpqEnv(
      'postgresql://hvli_migrator:p%40ss@localhost:5433/hvli?schema=x',
    );

    // Assert
    expect({ database, loopback }).toEqual({ database: 'hvli', loopback: true });
    expect(env).toMatchObject({
      PGHOST: 'localhost',
      PGPORT: '5433',
      PGUSER: 'hvli_migrator',
      PGPASSWORD: 'p@ss',
    });
    expect(Object.keys(toolEnv(env, '/usr/bin')).sort()).toEqual(
      ['LC_ALL', 'PATH', ...Object.keys(env)].sort(),
    );
  });

  it.each([
    ['postgresql://u:p@db.hvl.no/hvli', /sslmode=verify-full/],
    ['postgresql://u:p@db.hvl.no/hvli?sslmode=require', /sslmode=verify-full/],
    ['postgresql://u:p@db.hvl.no/hvli?sslmode=verify-full&sslmode=disable', /sslmode=verify-full/],
    ['mysql://u:p@localhost/hvli', /postgresql:\/\/ URL/],
    ['postgresql://u:p@localhost/', /names no database/],
    ['not a url', /not a URL/],
    [undefined, /not set/],
  ])('[DATA-004] refuses %s, naming the variable and never the value', (url, message) => {
    // Act and assert
    expect(() => libpqEnv(url)).toThrow(BackupConfigError);
    expect(() => libpqEnv(url)).toThrow(message);
    if (url) expect(() => libpqEnv(url)).not.toThrow(/u:p|db\.hvl\.no/);
  });

  it('[DATA-004] accepts a remote database that checks the server, with the system CAs by default', () => {
    // Act
    const strict = libpqEnv('postgresql://u:p@db.hvl.no/hvli?sslmode=require&sslaccept=strict').env;
    const own = libpqEnv('postgresql://u:p@db.hvl.no/hvli?sslmode=verify-ca&sslrootcert=/etc/hvl/ca.pem').env;

    // Assert
    expect(strict).toMatchObject({ PGSSLMODE: 'verify-full', PGSSLROOTCERT: 'system' });
    expect(own).toMatchObject({ PGSSLMODE: 'verify-ca', PGSSLROOTCERT: '/etc/hvl/ca.pem' });
  });

  it('[NFR-002] reads the major version from the tools and the server', () => {
    // Act and assert
    expect(toolMajor('pg_dump (PostgreSQL) 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)')).toBe(16);
    expect(toolMajor('pg_restore (PostgreSQL) 17.2')).toBe(17);
    expect(toolMajor('something else')).toBeUndefined();
    expect(serverMajor('160015\n')).toBe(16);
    expect(serverMajor('16.1')).toBeUndefined();
  });

  it('[NFR-002] accepts only table names as pg_dump writes them', () => {
    // Act and assert
    expect(TABLE_NAME.test('public."XapiStatement"')).toBe(true);
    expect(TABLE_NAME.test('public._prisma_migrations')).toBe(true);
    expect(TABLE_NAME.test('public."X"; DROP TABLE "User"')).toBe(false);
    expect(TABLE_NAME.test("public.x'")).toBe(false);
  });
});

describe('the messages and arguments of the backup CLI', () => {
  it('[DATA-009] shows one error line of a tool, without quoted values or DETAIL lines', () => {
    // Arrange
    const stderr = [
      'pg_restore: error: could not execute query: ERROR:  duplicate key value violates unique constraint "x_key"',
      'DETAIL:  Key ("learnerKey")=(abc123) already exists.',
      'psql: error: connection to server at "db.hvl.no" (10.0.0.5), port 5432 failed: FATAL: role "kari" denied',
    ].join('\n');

    // Act
    const message = toolFailure('pg_restore', 1, stderr);

    // Assert
    expect(message).toMatch(/^pg_restore exited with code 1: pg_restore: error: could not execute query/);
    expect(message).not.toMatch(/abc123|x_key|kari|db\.hvl\.no|DETAIL/);
  });

  it('[NFR-002] parses the three commands and refuses anything else', () => {
    // Act and assert
    expect(parseCliArgs(['backup', '--out', '/srv/b'])).toMatchObject({ command: 'backup', keepDays: 30 });
    expect(parseCliArgs(['backup', '--out', '/srv/b', '--keep-days', '7']).keepDays).toBe(7);
    expect(parseCliArgs(['restore', '--from', '/srv/b/x']).from).toBe('/srv/b/x');
    expect(() => parseCliArgs(['backup'])).toThrow(/--out/);
    expect(() => parseCliArgs(['verify'])).toThrow(/--from/);
    expect(() => parseCliArgs(['drop'])).toThrow(/unknown command/);
    expect(() => parseCliArgs(['backup', '--out', 'b', '--keep-days', '0'])).toThrow(/keep-days/);
    expect(() => parseCliArgs(['backup', '--out', 'b', '--password', 'x'])).toThrow();
  });
});

describe('the S3 settings of a backup', () => {
  it('[NFR-002] uses the server variables and ignores the SDK endpoint configuration', () => {
    // Act
    const settings = s3Settings({
      ...S3,
      S3_ENDPOINT: 'http://localhost:5000',
      S3_CONTENT_BUCKET: 'hvli-content',
    });

    // Assert
    expect(settings.bucket).toBe('hvli-content');
    expect(settings.client).toMatchObject({
      endpoint: 'http://localhost:5000',
      ignoreConfiguredEndpointUrls: true,
      forcePathStyle: true,
      region: 'eu-north-1',
    });
  });

  it.each([
    [{ S3_ENDPOINT: 'http://s3.hvl.no' }, /S3_ENDPOINT: a store on another host needs https/],
    [{ AWS_ENDPOINT_URL_S3: 'https://elsewhere.example' }, /AWS_ENDPOINT_URL_S3 is set/],
    [{ AWS_ENDPOINT_URL: 'https://elsewhere.example' }, /AWS_ENDPOINT_URL is set/],
    [{ S3_CONTENT_BUCKET: 'arn:aws:s3:us-east-1:123456789012:accesspoint/x' }, /plain bucket name/],
    [{ S3_SECRET_ACCESS_KEY: '' }, /must both be set/],
  ])('[DATA-004] refuses %o', (override, message) => {
    // Act and assert
    expect(() => s3Settings({ ...S3, ...override })).toThrow(message);
    expect(() => s3Settings({ ...S3, ...override })).not.toThrow(/elsewhere|s3\.hvl\.no|123456789012/);
  });
});
