/**
 * Tests for the mock Canvas's Platform Storage frame script, run in a sandbox, alone and against ltijs 7.0.7's own
 * client handshake (`_lti-storage-handshake.spy`).
 *
 * Spec: LTI-003
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { PLATFORM_STORAGE_SCRIPT, STORAGE_TARGET } from '../platformStorageFrame.mjs';

const TOOL = 'http://localhost:3999';
const CANVAS = 'http://127.0.0.1:4100';
// WHY: ltijs's `exports` hides package.json; its main entry sits in the package root.
const LTIJS = dirname(createRequire(import.meta.url).resolve('ltijs'));
const HANDSHAKE = readFileSync(join(LTIJS, 'services/launch/templates/_lti-storage-handshake.spy'), 'utf8');

/** Runs the frame script in a sandbox; `send` delivers one message and returns the replies it caused. */
function storageFrame() {
  const listeners = [];
  const config = JSON.stringify({ toolOrigin: TOOL, frameName: STORAGE_TARGET });
  const window = { addEventListener: (type, listener) => type === 'message' && listeners.push(listener) };
  const document = {
    getElementById: (id) => (id === 'mock-storage-config' ? { textContent: config } : null),
  };
  vm.runInNewContext(PLATFORM_STORAGE_SCRIPT, { window, document });
  const deliver = (event) => listeners.forEach((listener) => listener(event));
  const send = (data, origin = TOOL) => {
    const replies = [];
    const source = {
      postMessage: (answer, target) => replies.push({ answer: structuredClone(answer), target }),
    };
    deliver({ data, origin, source });
    return replies;
  };
  return { window, send, deliver };
}

const message = (subject, fields = {}) => ({ subject, message_id: `id-${subject}`, ...fields });

describe('[LTI-003] mock Canvas Platform Storage frame', () => {
  it('[LTI-003] answers lti.capabilities with put_data and get_data on its own frame', () => {
    // Act
    const [reply] = storageFrame().send(message('lti.capabilities'));
    // Assert
    expect(reply).toEqual({
      target: TOOL,
      answer: {
        subject: 'lti.capabilities.response',
        message_id: 'id-lti.capabilities',
        supported_messages: [
          { subject: 'lti.capabilities' },
          { subject: 'lti.put_data', frame: STORAGE_TARGET },
          { subject: 'lti.get_data', frame: STORAGE_TARGET },
        ],
      },
    });
  });

  it('[LTI-003] stores with put_data and returns with get_data, echoing subject, message_id and key', () => {
    // Arrange
    const frame = storageFrame();
    // Act
    const [put] = frame.send(message('lti.put_data', { key: 'state_a', value: 'token-a' }));
    const [got] = frame.send(message('lti.get_data', { key: 'state_a' }));
    const [unknown] = frame.send(message('lti.get_data', { key: 'state_b' }));
    // Assert
    expect(put).toEqual({
      target: TOOL,
      answer: {
        subject: 'lti.put_data.response',
        message_id: 'id-lti.put_data',
        key: 'state_a',
        value: 'token-a',
      },
    });
    expect(got.answer).toEqual({
      subject: 'lti.get_data.response',
      message_id: 'id-lti.get_data',
      key: 'state_a',
      value: 'token-a',
    });
    expect(unknown.answer.value).toBeNull();
  });

  it('[LTI-003] refuses another origin and keeps nothing it sent', () => {
    // Arrange
    const frame = storageFrame();
    // Act
    const [foreign] = frame.send(message('lti.put_data', { key: 'k', value: 'evil' }), 'https://evil.test');
    const [got] = frame.send(message('lti.get_data', { key: 'k' }));
    // Assert
    expect(foreign).toEqual({
      target: 'https://evil.test',
      answer: expect.objectContaining({
        error: { code: 'bad_request', message: 'origin is not the launched tool' },
      }),
    });
    expect(got.answer.value).toBeNull();
  });

  it('[LTI-003] refuses a missing key or an unknown subject, and ignores responses and other messages', () => {
    // Arrange
    const frame = storageFrame();
    // Act
    const [noKey] = frame.send(message('lti.get_data'));
    const [unknown] = frame.send(message('lti.close_frame'));
    const ignored = [message('lti.get_data.response', { key: 'k' }), 'text', { subject: 'other' }].flatMap(
      (data) => frame.send(data),
    );
    // Assert
    expect(noKey.answer.error.code).toBe('bad_request');
    expect(unknown.answer.error.code).toBe('unsupported_subject');
    expect(ignored).toEqual([]);
  });

  it('[LTI-003] logs each handled subject and key, without values, for browser tests', () => {
    const frame = storageFrame();
    frame.send(message('lti.put_data', { key: 'state_a', value: 'secret' }));
    expect(structuredClone(frame.window.mockPlatformStorage.log)).toEqual([
      { subject: 'lti.put_data', key: 'state_a', origin: TOOL },
    ]);
  });

  it("[LTI-003] serves ltijs 7.0.7's own handshake: put_data then get_data round-trip the recovery token", async () => {
    // Arrange: the tool frame runs ltijs's script; messages cross between the two frames asynchronously
    const frame = storageFrame();
    const toolListeners = new Set();
    const toolSource = {
      postMessage: (answer, target) =>
        target === TOOL &&
        setTimeout(() =>
          toolListeners.forEach((listener) => listener({ data: structuredClone(answer), origin: CANVAS })),
        ),
    };
    const storageWindow = {
      postMessage: (data, target) =>
        target === CANVAS &&
        setTimeout(() => frame.deliver({ data: structuredClone(data), origin: TOOL, source: toolSource })),
    };
    const toolWindow = {
      parent: { frames: { [STORAGE_TARGET]: storageWindow } },
      addEventListener: (_type, listener) => toolListeners.add(listener),
      removeEventListener: (_type, listener) => toolListeners.delete(listener),
    };
    const tool = vm.createContext({ window: toolWindow, setTimeout, clearTimeout });
    vm.runInContext(HANDSHAKE, tool);
    const call = (subject, fields) =>
      vm.runInContext('ltiSendStorageMessage', tool)(STORAGE_TARGET, CANVAS, subject, 'state_s1', fields);
    // Act
    await call('lti.put_data', { key: 'state_s1', value: 'recovery-token' });
    const response = await call('lti.get_data', { key: 'state_s1' });
    // Assert
    expect(response.value).toBe('recovery-token');
    expect(toolListeners.size).toBe(0);
  });
});
