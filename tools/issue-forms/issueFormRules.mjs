/**
 * issueFormRules — checks the pilot's GitHub issue forms, the issue chooser's config and the label list against
 * GitHub's form syntax and against each other.
 *
 * Why: GitHub checks an issue form only when someone opens it, not when it is pushed, and it leaves off any label
 *      that does not exist in the repository. A form with a wrong key would be missing from the chooser, or issues
 *      would arrive without the privacy check or the triage label (D-101's amendment of 2026-11-05). These checks
 *      run with every test run, long before a tester meets a broken form.
 * Spec: NFR-004, DATA-010
 * Invariants:
 *   - Pure checks of parsed values: each function returns problems as text, and an empty list when all is well.
 *   - Files are read as YAML 1.1, so a value that YAML 1.1 reads as a boolean or a number (`no`, `on`, `004357`)
 *     fails a check here, whichever YAML version GitHub's parser follows.
 *   - Only the keys GitHub's form schema documents are accepted: an unknown key is a problem, never ignored.
 * Collaborators: .github/ISSUE_TEMPLATE/*.yml, .github/labels.yml, yaml (hoisted from apps/server's dependencies,
 *   as tools/deploy-check uses it).
 * Tests: tools/issue-forms/test/issueFormSyntax.test.mjs, tools/issue-forms/test/issueFormContent.test.mjs
 */
import { parseDocument } from 'yaml';

const TOP_KEYS = ['name', 'description', 'title', 'labels', 'assignees', 'projects', 'type', 'body'];
const FIELD_KEYS = ['type', 'id', 'attributes', 'validations'];
/** The attributes GitHub's form schema allows for each field type. */
const ATTRIBUTES = {
  markdown: ['value'],
  textarea: ['label', 'description', 'placeholder', 'value', 'render'],
  input: ['label', 'description', 'placeholder', 'value'],
  dropdown: ['label', 'description', 'multiple', 'options', 'default'],
  checkboxes: ['label', 'description', 'options'],
};
const ID = /^[A-Za-z0-9_-]+$/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const unknownKeys = (value, allowed) => Object.keys(value).filter((key) => !allowed.includes(key));

/**
 * Parses a file's text as YAML 1.1 and collects what the parser objects to, duplicate keys included.
 * @param {string} text - The file's text.
 * @returns {{value: unknown, problems: string[]}} The parsed value, and the parser's errors and warnings.
 */
export function readYaml(text) {
  const doc = parseDocument(text, { version: '1.1', uniqueKeys: true });
  const problems = [...doc.errors, ...doc.warnings].map((error) => error.message.split('\n')[0]);
  return { value: doc.toJS(), problems };
}

/** Problems with a field's `validations`, which may only say whether the field is required. */
function validationProblems(field, where) {
  const { validations } = field;
  if (validations === undefined) return [];
  const onlyRequired = isObject(validations) && unknownKeys(validations, ['required']).length === 0;
  return onlyRequired && typeof validations.required === 'boolean'
    ? []
    : [`${where}: "validations" may only hold required: true or false`];
}

/** Problems with the choices of a dropdown or a checkbox group. */
function optionProblems(field, where) {
  const { options, multiple, default: preset } = field.attributes;
  if (field.type !== 'dropdown' && field.type !== 'checkboxes') return [];
  if (!Array.isArray(options) || options.length === 0)
    return [`${where}: "options" must be a non-empty list`];
  if (field.type === 'checkboxes') {
    const valid = (option) =>
      isObject(option) &&
      isText(option.label) &&
      unknownKeys(option, ['label', 'required']).length === 0 &&
      (option.required === undefined || typeof option.required === 'boolean');
    return options.flatMap((option, i) =>
      valid(option) ? [] : [`${where}: option ${i} needs a text label and may have required: true or false`],
    );
  }
  const problems = [];
  if (!options.every(isText)) problems.push(`${where}: every option must be text`);
  if (new Set(options).size !== options.length) problems.push(`${where}: options must be distinct`);
  // WHY: GitHub adds its own «None» to a dropdown that is not required; an option of that name could not be told
  // apart from it in the issue.
  if (options.some((option) => String(option).trim().toLowerCase() === 'none')) {
    problems.push(`${where}: an option may not be called "None"`);
  }
  if (multiple !== undefined && typeof multiple !== 'boolean')
    problems.push(`${where}: "multiple" must be boolean`);
  if (preset !== undefined && !(Number.isInteger(preset) && preset >= 0 && preset < options.length)) {
    problems.push(`${where}: "default" must be the index of an option`);
  }
  return problems;
}

/** Problems with one element of a form's body; `ids` and `labels` collect what earlier elements used. */
function fieldProblems(field, at, ids, labels) {
  if (!isObject(field) || !Object.hasOwn(ATTRIBUTES, field.type)) return [`${at}: unknown field type`];
  const where = `${at} (${field.type}${typeof field.id === 'string' ? ` ${field.id}` : ''})`;
  const problems = unknownKeys(field, FIELD_KEYS).map((key) => `${where}: unknown key "${key}"`);
  const attributes = field.attributes;
  if (!isObject(attributes)) return [...problems, `${where}: "attributes" must be a mapping`];
  for (const key of unknownKeys(attributes, ATTRIBUTES[field.type]))
    problems.push(`${where}: unknown attribute "${key}"`);
  if (field.type === 'markdown') {
    if (!isText(attributes.value)) problems.push(`${where}: "value" must be text`);
    if (field.id !== undefined || field.validations !== undefined) {
      problems.push(`${where}: markdown takes no id or validations`);
    }
    return problems;
  }
  if (!isText(attributes.label)) problems.push(`${where}: "label" must be text`);
  else if (labels.has(attributes.label)) problems.push(`${where}: duplicate label "${attributes.label}"`);
  else labels.add(attributes.label);
  if (field.id !== undefined && !(typeof field.id === 'string' && ID.test(field.id))) {
    problems.push(`${where}: an id may hold only letters, digits, - and _`);
  } else if (field.id !== undefined && ids.has(field.id)) problems.push(`${where}: duplicate id`);
  else if (field.id !== undefined) ids.add(field.id);
  for (const key of ['description', 'placeholder', 'value', 'render']) {
    if (attributes[key] !== undefined && typeof attributes[key] !== 'string')
      problems.push(`${where}: "${key}" must be text`);
  }
  return [...problems, ...validationProblems(field, where), ...optionProblems(field, where)];
}

/**
 * Checks one issue form against GitHub's form schema and the repository's labels.
 * @param {unknown} form - The parsed form.
 * @param {Set<string>} labelNames - The label names in .github/labels.yml.
 * @returns {string[]} Problems found.
 */
export function formProblems(form, labelNames) {
  if (!isObject(form)) return ['a form must be a mapping'];
  const problems = unknownKeys(form, TOP_KEYS).map((key) => `unknown top-level key "${key}"`);
  for (const key of ['name', 'description']) if (!isText(form[key])) problems.push(`"${key}" must be text`);
  if (form.title !== undefined && typeof form.title !== 'string') problems.push('"title" must be text');
  if (form.labels !== undefined && !Array.isArray(form.labels)) problems.push('"labels" must be a list');
  for (const label of Array.isArray(form.labels) ? form.labels : []) {
    if (!labelNames.has(label)) problems.push(`label "${label}" is not in .github/labels.yml`);
  }
  if (!Array.isArray(form.body) || form.body.length === 0)
    return [...problems, '"body" must be a non-empty list'];
  const ids = new Set();
  const labels = new Set();
  form.body.forEach((field, i) => problems.push(...fieldProblems(field, `body[${i}]`, ids, labels)));
  if (!form.body.some((field) => isObject(field) && field.type !== 'markdown')) {
    problems.push('a form needs at least one field that is not markdown');
  }
  return problems;
}

/**
 * Checks the issue chooser's config.yml.
 * @param {unknown} config - The parsed config.
 * @returns {string[]} Problems found.
 */
export function configProblems(config) {
  if (!isObject(config)) return ['config.yml must be a mapping'];
  const problems = unknownKeys(config, ['blank_issues_enabled', 'contact_links']).map(
    (key) => `unknown key "${key}"`,
  );
  if (typeof config.blank_issues_enabled !== 'boolean')
    problems.push('"blank_issues_enabled" must be true or false');
  const links = config.contact_links ?? [];
  if (!Array.isArray(links)) return [...problems, '"contact_links" must be a list'];
  links.forEach((link, i) => {
    const complete = isObject(link) && ['name', 'url', 'about'].every((key) => isText(link[key]));
    if (!complete || unknownKeys(link, ['name', 'url', 'about']).length > 0) {
      problems.push(`contact_links[${i}] needs exactly name, url and about, as text`);
    } else if (!link.url.startsWith('https://')) problems.push(`contact_links[${i}]: the url must use https`);
  });
  return problems;
}

/**
 * Checks the label list: unique names (GitHub ignores letter case) of at most 50 characters, colours as six
 * hexadecimal digits, and descriptions of at most 100 characters, GitHub's limits.
 * @param {unknown} labels - The parsed .github/labels.yml.
 * @returns {string[]} Problems found.
 */
export function labelListProblems(labels) {
  if (!Array.isArray(labels) || labels.length === 0) return ['labels.yml must be a non-empty list'];
  const seen = new Set();
  return labels.flatMap((label, i) => {
    if (!isObject(label) || unknownKeys(label, ['name', 'color', 'description']).length > 0) {
      return [`label ${i}: only name, color and description are allowed`];
    }
    const problems = [];
    if (!isText(label.name) || label.name.length > 50)
      problems.push(`label ${i}: the name must be 1–50 characters`);
    else if (seen.has(label.name.toLowerCase())) problems.push(`label "${label.name}" appears twice`);
    else seen.add(label.name.toLowerCase());
    if (typeof label.color !== 'string' || !/^[0-9A-Fa-f]{6}$/.test(label.color)) {
      problems.push(`label ${i}: the color must be six hexadecimal digits, quoted`);
    }
    if (!isText(label.description) || label.description.length > 100) {
      problems.push(`label ${i}: the description must be 1–100 characters`);
    }
    return problems;
  });
}
