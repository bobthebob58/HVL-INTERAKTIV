/**
 * Tests that the pilot's issue forms ask for what a fix needs, give each severity its label, and keep personal data
 * out of issues (D-101's amendment of 2026-11-05, problem reporting).
 *
 * Spec: NFR-004, NFR-003, DATA-010, DATA-009, UD-031, PROD-002
 */
import { describe, it, expect } from 'vitest';
import { FORMS, config, fieldOf, forms, labelNames, optionsOf, read } from './issueFormFiles.mjs';

const required = (type) => ({ type, validations: { required: true } });

describe('[NFR-004] what a fix needs', () => {
  it('[NFR-004] both forms require the steps, what was expected and happened, the place, the type and the severity', () => {
    // Act and assert: per form, the fields a fix starts from; the screenshot field that takes images.
    for (const file of FORMS) {
      for (const id of ['steps', 'expected', 'actual']) {
        expect(fieldOf(file, id), `${file} ${id}`).toMatchObject(required('textarea'));
      }
      for (const id of ['place', 'activity-type', 'severity']) {
        expect(fieldOf(file, id), `${file} ${id}`).toMatchObject(required('dropdown'));
      }
      // WHY: a textarea with `render` becomes a code block, which takes no attached images.
      expect(fieldOf(file, 'screenshot')).toMatchObject({
        type: 'textarea',
        attributes: { label: 'Skjermbilete' },
      });
      expect(fieldOf(file, 'screenshot').attributes.render).toBeUndefined();
    }
    expect(optionsOf('uu-barriere.yml', 'place')).toEqual(optionsOf('feil.yml', 'place'));
  });

  it('[NFR-004] every severity choice has its label, the same three in both forms', () => {
    const fromChoices = optionsOf('feil.yml', 'severity').map((option) => {
      const [, level, word] = /^(\d) – ([^:]+):/.exec(option) ?? [];
      return `alvor ${level}: ${word}`.toLowerCase();
    });
    const severityLabels = [...labelNames]
      .filter((name) => name.startsWith('alvor '))
      .map((n) => n.toLowerCase());
    expect(fromChoices).toEqual(['alvor 1: kritisk', 'alvor 2: uu-barriere', 'alvor 3: kosmetisk']);
    expect(severityLabels).toEqual(fromChoices);
    expect(optionsOf('uu-barriere.yml', 'severity')).toEqual(optionsOf('feil.yml', 'severity'));
  });
});

describe('[DATA-010] no personal data reaches an issue', () => {
  it('[DATA-010] every form opens with the rule and cannot be sent until the reporter confirms it', () => {
    const words = ['personopplysningar', 'namn', 'e-postadresser', 'Feide-ID', 'fødselsnummer', 'svar'];
    for (const file of FORMS) {
      const [intro, check] = forms[file].body;
      expect(intro.type).toBe('markdown');
      for (const word of [...words, 'tryggleiksproblem']) {
        expect(intro.attributes.value, `${file}: ${word}`).toContain(word);
      }
      expect(check).toMatchObject({ type: 'checkboxes', id: 'privacy' });
      expect(check.attributes.options).toEqual([expect.objectContaining({ required: true })]);
    }
  });

  it('[DATA-010] blank issues are off, and no field asks for a name, a way to reach the reporter or a health reason', () => {
    // Act and assert: the chooser, then every field of both forms.
    expect(config.blank_issues_enabled).toBe(false);
    for (const file of FORMS) {
      for (const field of forms[file].body.filter((f) => f.type !== 'markdown' && f.id !== 'privacy')) {
        expect(field.attributes.label, `${file} ${field.id}`).not.toMatch(
          /namn|e-post|telefon|Feide|kontakt/i,
        );
      }
      // PRIVACY: why someone uses assistive technology is health information; the field says it is not needed.
      expect(fieldOf(file, 'assistive-technology').attributes.description).toContain(
        'Du treng ikkje skrive kvifor du brukar det.',
      );
    }
  });
});

describe('[DATA-009] the server log lines that a fix in HVL needs', () => {
  it('[DATA-009] the fault form takes the log lines as a code block with the time to find them, never required', () => {
    const logLines = fieldOf('feil.yml', 'log-lines');
    expect(logLines).toMatchObject({ type: 'textarea', attributes: { render: 'text' } });
    expect(logLines.validations?.required ?? false).toBe(false);
    expect(logLines.attributes.description).toContain(
      'Ikkje lim inn loggar frå Canvas, frå Feide eller frå nettlesaren',
    );
    expect(fieldOf('feil.yml', 'time').type).toBe('input');
    expect(fieldOf('feil.yml', 'error-text').attributes.render).toBe('text');
  });
});

describe('[NFR-003] the set-up a problem was seen in', () => {
  it('[NFR-003] both forms require the device, the browser, the assistive technology and the zoom', () => {
    for (const file of FORMS) {
      for (const id of ['device', 'browser', 'assistive-technology', 'zoom']) {
        expect(fieldOf(file, id), `${file} ${id}`).toMatchObject(required('input'));
      }
    }
  });
});

describe('[UD-031] barriers found in a manual protocol run', () => {
  it("[UD-031] the barrier form offers the protocol's set-ups and asks for the dated result file", () => {
    // Arrange: the set-up IDs of the protocol's §3 table, which also name the dated result files.
    const protocol = read('docs/accessibility/manual-test-protocol.md');
    const setUps = [...protocol.matchAll(/^\| \*\*([A-Z0-9-]+)\*\* \|/gm)].map((match) => match[1]);
    // Act
    const options = optionsOf('uu-barriere.yml', 'protocol-setup');
    // Assert
    expect(setUps).toEqual(['AT-1', 'AT-2', 'AT-3', 'KB', 'Z400']);
    for (const id of [...setUps, 'PDF'])
      expect(
        options.filter((o) => o.startsWith(`${id}: `)),
        id,
      ).toHaveLength(1);
    const resultFile = fieldOf('uu-barriere.yml', 'result-file').attributes.description;
    expect(resultFile).toContain('docs/accessibility/results/');
    expect(fieldOf('uu-barriere.yml', 'retest').type).toBe('checkboxes');
  });
});

describe('[PROD-002] the activity types a problem can be in', () => {
  it('[PROD-002] both forms offer exactly the ten authorable types, by their Nynorsk names in the web app', () => {
    const names = Object.values(JSON.parse(read('apps/web/src/i18n/locales/nn.json')).contentType);
    expect(names).toHaveLength(10);
    for (const file of FORMS) {
      expect(optionsOf(file, 'activity-type')).toEqual(['Gjeld ikkje ein aktivitet', ...names, 'Veit ikkje']);
    }
  });
});
