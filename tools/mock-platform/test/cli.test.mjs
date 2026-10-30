/**
 * Tests for the mock platform CLI: it starts both mocks on the given ports, prints the tool environment and the Canvas
 * service controls, and stops cleanly on SIGINT and SIGTERM.
 *
 * Spec: LTI-001, LTI-012, AUTH-001
 */
import { describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { envLines, parseCliArgs } from '../cli.mjs';

const CLI = fileURLToPath(new URL('../cli.mjs', import.meta.url));

/** A port that was free a moment ago (the OS picks it; the CLI then binds it). */
const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer().once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

/** Starts the CLI and resolves once it has printed its last start-up line. */
function startCli(args) {
  const child = spawn(process.execPath, [CLI, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  const exited = new Promise((resolve) => child.once('exit', (code) => resolve({ code, out })));
  const ready = new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      out += chunk;
      if (out.includes('Press Ctrl+C to stop.')) resolve(out);
    });
    child.stderr.on('data', (chunk) => (out += chunk));
    exited.then(() => reject(new Error(`CLI exited early:\n${out}`)));
  });
  return { child, ready, exited };
}

describe('[LTI-001] mock platform CLI', () => {
  it.each(['SIGINT', 'SIGTERM'])(
    '[LTI-001] serves both mocks on the given ports, prints the env and stops on %s',
    async (signal) => {
      // Arrange
      const [canvasPort, feidePort] = [await freePort(), await freePort()];
      const args = ['--tool-url', 'http://localhost:3999', '--canvas-port', String(canvasPort)];
      const cli = startCli([...args, '--feide-port', String(feidePort)]);
      // Act
      const printed = await cli.ready;
      const jwks = await fetch(`http://127.0.0.1:${canvasPort}/api/lti/security/jwks`);
      const discovery = await fetch(`http://localhost:${feidePort}/.well-known/openid-configuration`);
      const services = await fetch(`http://127.0.0.1:${canvasPort}/__mock/services`);
      cli.child.kill(signal);
      const { code, out } = await cli.exited;
      // Assert
      expect(printed).toContain(`FEIDE_ISSUER=http://localhost:${feidePort}\n`);
      expect(printed).toContain(`CANVAS_ORIGINS=http://127.0.0.1:${canvasPort}\n`);
      expect(printed).toMatch(/^LTI_PLATFORMS='\[\{"name":"Mock Canvas".*\}\]'$/m);
      expect(printed).toContain(`home page with demo launches: http://127.0.0.1:${canvasPort}/`);
      expect(printed).toContain(
        `scores and token requests at http://127.0.0.1:${canvasPort}/__mock/services`,
      );
      expect(printed).toContain(`POST http://127.0.0.1:${canvasPort}/__mock/faults?target=scores&status=503`);
      expect([jwks.status, discovery.status, services.status]).toEqual([200, 200, 200]);
      expect([code, out]).toEqual([0, expect.stringContaining(`Mock platform stopped (${signal}).`)]);
    },
    20_000,
  );

  it('[LTI-001] exits with code 2 and the usage for bad arguments', () => {
    // Arrange
    const bad = [
      [],
      ['--tool-url', 'ftp://tool'],
      ['--tool-url', 'http://localhost:1', '--canvas-port', 'x'],
    ];
    // Act and assert
    for (const args of [...bad, ['--unknown']]) {
      const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8', timeout: 10_000 });
      expect([result.status, result.stderr]).toEqual([
        2,
        expect.stringContaining('usage: node tools/mock-platform'),
      ]);
    }
  });

  it('[AUTH-001] parses ports and single-quotes JSON values in the printed env', () => {
    // Act and assert
    expect(parseCliArgs(['--tool-url', 'http://localhost:3000', '--feide-port', '4200'])).toEqual({
      toolUrl: 'http://localhost:3000',
      canvasPort: 0,
      feidePort: 4200,
    });
    expect(() => parseCliArgs(['--tool-url', 'http://x', '--feide-port', '70000'])).toThrow(RangeError);
    expect(() => parseCliArgs(['--tool-url', 'x'])).toThrow(TypeError);
    expect(envLines({ A: 'http://x', LTI_PLATFORMS: '[{"a":1}]' })).toEqual([
      'A=http://x',
      `LTI_PLATFORMS='[{"a":1}]'`,
    ]);
  });
});
