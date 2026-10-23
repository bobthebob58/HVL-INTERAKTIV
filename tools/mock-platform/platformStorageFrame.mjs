/**
 * platformStorageFrame — the mock Canvas's LTI Platform Storage frame: a hidden sibling of the tool's iframe that
 * answers the postMessages `lti.capabilities`, `lti.put_data` and `lti.get_data`.
 *
 * Why: where a browser blocks storage in the third-party tool frame, ltijs keeps its short-lived OIDC recovery
 *      token in Platform Storage instead (D-050). The LTI-003 end-to-end test needs a platform frame that answers
 *      exactly as ltijs 7.0.7's client expects (node_modules/ltijs/services/launch/templates/
 *      `_lti-storage-handshake.spy`): it finds the frame as `parent.frames[lti_storage_target]`, posts to the
 *      platform's login origin, and accepts only a reply from that origin with `subject + '.response'` and the same
 *      `message_id`, reading `value` from a `get_data` reply.
 * Spec: LTI-003
 * Invariants:
 *   - Only messages from the tool's origin are served; others get an error reply and store nothing.
 *   - Values are kept per sender origin and key, in this frame's memory, for the life of the course page.
 *   - Replies go to `event.source` with the sender's origin as target origin, never `*`.
 *   - `window.mockPlatformStorage.log` lists each handled subject and key (no values), for browser tests.
 * Collaborators: ./canvasPages.mjs (embeds the frame), ./httpRouter.mjs.
 * Tests: tools/mock-platform/test/platformStorageFrame.test.mjs
 */
import { htmlDocument, jsonForScript } from './httpRouter.mjs';

/** The frame name Canvas sends as `lti_storage_target`. */
export const STORAGE_TARGET = 'post_message_forwarding';

/** The frame's script; it reads `{toolOrigin, frameName}` from `#mock-storage-config`. Plain ES5 for any browser. */
export const PLATFORM_STORAGE_SCRIPT = `(function () {
  var config = JSON.parse(document.getElementById('mock-storage-config').textContent);
  var store = Object.create(null);
  var log = [];
  window.mockPlatformStorage = { log: log };
  var supported = [
    { subject: 'lti.capabilities' },
    { subject: 'lti.put_data', frame: config.frameName },
    { subject: 'lti.get_data', frame: config.frameName }
  ];
  window.addEventListener('message', function (event) {
    var message = event.data;
    if (!message || typeof message.subject !== 'string' || !/^lti\\.[a-z_.]+$/.test(message.subject)) return;
    if (/\\.response$/.test(message.subject) || !event.source) return;
    var reply = function (fields) {
      var answer = { subject: message.subject + '.response', message_id: message.message_id };
      for (var name in fields) answer[name] = fields[name];
      event.source.postMessage(answer, event.origin);
    };
    var fail = function (code, text) { reply({ error: { code: code, message: text } }); };
    log.push({ subject: message.subject, key: message.key, origin: event.origin });
    if (event.origin !== config.toolOrigin) return fail('bad_request', 'origin is not the launched tool');
    if (message.subject === 'lti.capabilities') return reply({ supported_messages: supported });
    if (message.subject !== 'lti.put_data' && message.subject !== 'lti.get_data') {
      return fail('unsupported_subject', 'unsupported subject ' + message.subject);
    }
    if (typeof message.key !== 'string' || message.key === '') return fail('bad_request', 'key is required');
    var slot = event.origin + ' ' + message.key;
    if (message.subject === 'lti.put_data') {
      store[slot] = message.value;
      return reply({ key: message.key, value: message.value });
    }
    reply({ key: message.key, value: slot in store ? store[slot] : null });
  });
})();`;

/**
 * The storage frame's HTML page.
 * @param {string} toolOrigin - The only origin served, e.g. `http://localhost:3000`.
 * @returns {string} The document.
 */
export const platformStorageFramePage = (toolOrigin) =>
  htmlDocument(
    'Mock Canvas · Platform Storage',
    `<script type="application/json" id="mock-storage-config">${jsonForScript({
      toolOrigin,
      frameName: STORAGE_TARGET,
    })}</script><script>${PLATFORM_STORAGE_SCRIPT}</script>`,
  );
