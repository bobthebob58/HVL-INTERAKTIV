/**
 * Tests that the database role runner applies the production TLS rule to its connection: a database on another host
 * needs `sslmode` `require`, `verify-ca` or `verify-full`, read as node-postgres reads it (the last `sslmode`, the
 * last `host` parameter, `PGHOST` when the URL names no host), while a socket, `localhost`, `127.x.y.z` and `::1` may
 * go without; and that `npm run db:roles` refuses before it connects, naming the variable but never the URL.
 *
 * Spec: DATA-004
 */
import { describe, expect, it } from 'vitest';
import { DATABASE_ROLES_TLS_PROBLEM, databaseRolesUrlProblem } from '../../src/infra/databaseRolesCli.js';
import { runServerCli } from '../support/serverCli.js';

const PASSWORD = 'n0t-a-real-Passw0rd';
const remote = (query = '') => `postgresql://hvli_migrator:${PASSWORD}@db.example.invalid:5432/hvli${query}`;

describe('[DATA-004] the role runner’s TLS rule', () => {
  it('[DATA-004] a database on another host needs an encrypting sslmode', () => {
    // Act
    const refused = [
      '',
      '?sslmode=disable',
      '?sslmode=allow',
      '?sslmode=prefer',
      '?ssl=true',
      '?sslmode=no-verify',
    ].map((query) => databaseRolesUrlProblem(remote(query), ''));
    const accepted = ['?sslmode=verify-full', '?sslmode=verify-ca', '?sslmode=require&sslaccept=strict'].map(
      (query) => databaseRolesUrlProblem(remote(query), ''),
    );
    // Assert
    expect(refused).toEqual(Array(6).fill(DATABASE_ROLES_TLS_PROBLEM));
    expect(accepted).toEqual([undefined, undefined, undefined]);
  });

  it('[DATA-004] a database on this machine may go without TLS: a socket, localhost, 127.x.y.z or ::1', () => {
    // Arrange
    const local = [
      'postgresql://hvli:pw@localhost:5432/hvli',
      'postgresql://hvli:pw@LOCALHOST/hvli',
      'postgresql://hvli:pw@127.0.0.1:5432/hvli',
      'postgres://hvli:pw@127.12.0.3/hvli',
      'postgresql://hvli:pw@[::1]:5432/hvli',
      'postgresql:///hvli',
      'postgresql://hvli:pw@/hvli?host=/var/run/postgresql',
      'postgresql://hvli:pw@%2Fvar%2Frun%2Fpostgresql/hvli',
    ];
    // Act
    const problems = local.map((url) => databaseRolesUrlProblem(url, ''));
    // Assert
    expect(problems).toEqual(Array(local.length).fill(undefined));
  });

  it('[DATA-004] judges the host and sslmode node-postgres would use, never a look-alike', () => {
    // Arrange
    const refused = [
      // The last sslmode wins, so a trailing `disable` undoes the first.
      remote('?sslmode=verify-full&sslmode=disable'),
      // A `host` parameter overrides the URL's host.
      'postgresql://hvli:pw@localhost/hvli?host=db.example.invalid',
      // The last `host` parameter wins, so a socket named first does not make a remote host local.
      'postgresql://hvli:pw@localhost/hvli?host=/var/run/postgresql&host=db.example.invalid',
      // A name that starts like a loopback address is resolved by DNS.
      'postgresql://hvli:pw@127.0.0.1.example.invalid/hvli',
      'postgresql://hvli:pw@localhost.example.invalid/hvli',
      // Two hosts, one of them remote.
      'postgresql://hvli:pw@localhost,db.example.invalid/hvli',
      'postgresql://hvli:pw@exa mple/hvli',
    ];
    // Act
    const problems = refused.map((url) => databaseRolesUrlProblem(url, ''));
    const lastWins = databaseRolesUrlProblem(remote('?sslmode=disable&sslmode=verify-full'), '');
    // Assert
    expect(problems).toEqual(Array(refused.length).fill(DATABASE_ROLES_TLS_PROBLEM));
    expect(lastWins).toBeUndefined();
  });

  it('[DATA-004] a URL without a host is judged by PGHOST, where node-postgres then connects', () => {
    expect(databaseRolesUrlProblem('postgresql:///hvli', 'db.example.invalid')).toBe(
      DATABASE_ROLES_TLS_PROBLEM,
    );
    expect(databaseRolesUrlProblem('postgresql:///hvli', '/var/run/postgresql')).toBeUndefined();
    expect(
      databaseRolesUrlProblem('postgresql:///hvli?sslmode=verify-full', 'db.example.invalid'),
    ).toBeUndefined();
  });

  it('[DATA-004] npm run db:roles refuses a clear-text remote URL before connecting, never printing it', async () => {
    // Act
    const run = await runServerCli('db:roles', ['grants'], { DATABASE_URL: remote('?sslmode=prefer') });
    // Assert
    expect(run.code).toBe(1);
    expect(run.stderr).toBe(`database roles refused: ${DATABASE_ROLES_TLS_PROBLEM}\n`);
    expect(run.stdout).toBe('');
    expect(`${run.stdout}${run.stderr}`).not.toContain(PASSWORD);
    expect(run.stderr).not.toContain('db.example.invalid');
  }, 60_000);
});
