/**
 * renderCriterion — writes the section of one WCAG success criterion: its manual block, then the generated
 * evidence (axe rules, our checks with their views, results and test links, the protocol steps, the register's
 * upstream barriers and the map's note).
 *
 * Why: UD-040 asks, per criterion, how it is tested, where, with what result, and with links to the tests. One
 *      renderer gives every criterion the same shape, so a reader (and HVL's uustatus.no statement) finds the same
 *      facts in the same place, and a criterion with no automated check says so instead of looking empty.
 * Spec: UD-040
 * Invariants:
 *   - Output depends only on its inputs: no clock, no environment, no file system.
 *   - A check that matches no test throws (the map is stale); a suite check's result comes from the run summary
 *     only, every other check's tests are linked under the command that runs them: `npm test` first, then
 *     `npm run test:e2e` (./testIndex.mjs `commandOf`).
 *   - Links are relative to docs/accessibility/, where the report lives.
 * Collaborators: ./renderReport.mjs, ./testIndex.mjs, ./runResults.mjs, ./axeRuleIndex.mjs, ./protocolIndex.mjs,
 *   ./manualBlocks.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { rulesOfCriterion } from './axeRuleIndex.mjs';
import { criterionBlockId, manualBlock } from './manualBlocks.mjs';
import { protocolText } from './protocolIndex.mjs';
import { axeFindings, findingsText, resultText, suiteResult } from './runResults.mjs';
import { NPM_TEST, commandOf, testsOfCheck } from './testIndex.mjs';
import { ENGLISH_TEXT_CRITERION, issueText } from './upstreamEntries.mjs';
import { understandingUrl } from './wcagCriteria.mjs';

/** From docs/accessibility/ to the repository root. */
const UP = '../../';

/**
 * A Markdown link to a repository file.
 * @param {string} file - Repository-relative path.
 * @returns {string} The link, with the path as its text.
 */
export const fileLink = (file) => `[\`${file}\`](${UP}${file})`;

/**
 * Text from a source file made safe to show as Markdown prose: `<li>` stays text instead of becoming markup.
 * @param {string} text - Text as the source writes it.
 * @returns {string} The same text with `<` escaped.
 */
export const plain = (text) => String(text).replace(/</g, '&lt;');

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The register entries that concern a criterion.
 * @param {{findings: object[], englishTexts: object[]}} register - From ./upstreamEntries.mjs.
 * @param {{rules: object[]}} axeIndex - From ./axeRuleIndex.mjs.
 * @param {string} id - The criterion's number.
 * @returns {string[]} One line per entry.
 */
export function upstreamLines(register, axeIndex, id) {
  const tagsOf = (ruleId) => axeIndex.rules.find((r) => r.id === ruleId)?.criteria ?? [];
  const findings = register.findings
    .filter((f) => tagsOf(f.ruleId).includes(id))
    .map(
      (f) =>
        `\`${f.ruleId}\` in the ${f.surfaces.join(' and ')} of ${f.types.map((t) => (t === '*' ? 'every content type' : t)).join(', ')}: ${plain(f.why)}. ` +
        `Source: <${f.source}>. Issue: ${issueText(f)}.`,
    );
  const texts =
    id === ENGLISH_TEXT_CRITERION
      ? register.englishTexts.map(
          (t) =>
            `${t.library} writes «${plain(t.text)}» in English in every language (${plain(t.shownWhen)}): ${plain(t.why)}. ` +
            `Source: <${t.source}>. Issue: ${issueText(t)}.`,
        )
      : [];
  return [...findings, ...texts];
}

/**
 * The protocol steps and page checks of a criterion: those the evidence map names, then the §7 checks whose
 * criterion column names it.
 * @param {{protocol: string[]}} evidence - Its entry in the evidence map.
 * @param {{checks: {name: string, criteria: string[]}[]}} protocol - From ./protocolIndex.mjs.
 * @param {string} id - The criterion's number.
 * @returns {string[]} References such as `J2.3` and `§7 Skip link`.
 */
export function protocolRefs(evidence, protocol, id) {
  const pageChecks = protocol.checks
    .filter((c) => c.criteria.includes(id) && !evidence.protocol.includes(`§7 ${c.name}`))
    .map((c) => `§7 ${c.name}`);
  return [...evidence.protocol, ...pageChecks];
}

/**
 * The line of one of our checks.
 * @param {object} check - A check of the evidence map.
 * @param {{index: object[], summary: object | undefined, criterionId: string}} ctx - Tests and the run.
 * @returns {string} A list item.
 * @throws Error when the check matches no test.
 */
function checkLine(check, { index, summary, criterionId }) {
  const files = testsOfCheck(index, check);
  if (files.length === 0)
    throw new Error(
      `criterion ${criterionId}: no running test matches [${check.match.join('][')}] ${check.suite ?? ''}`,
    );
  const ids = check.match.map((m) => `\`${m}\``).join(' ');
  const linksOf = (group) =>
    group.map((f) => `${fileLink(f.file)} (${plural(f.titles.length, 'test title')})`).join(', ');
  if (check.suite)
    return `- ${ids}, accessibility suite: ${check.how}. Views: ${check.views}. Last run: ${resultText(suiteResult(summary, check))}. Tests: ${linksOf(files)}.`;
  // WHY: an end-to-end test linked as part of `npm test` sends an auditor to a run that never starts it.
  const byCommand = Map.groupBy(files, (f) => commandOf(f.file));
  const commands = [...byCommand.keys()].sort((a, b) =>
    a === NPM_TEST ? -1 : b === NPM_TEST ? 1 : a.localeCompare(b),
  );
  const runs = commands.map((command) => `\`${command}\`: ${linksOf(byCommand.get(command))}`).join('; in ');
  return `- ${ids}: ${check.how}. Runs in ${runs}.`;
}

/**
 * The line of the axe rules of a criterion.
 * @param {{running: object[], notRunning: object[]}} rules - From rulesOfCriterion.
 * @param {object | undefined} summary - The run summary.
 * @returns {string[]} Zero, one or two list items.
 */
function axeLines(rules, summary) {
  const lines = [];
  if (rules.running.length) {
    const names = rules.running.map((r) => `[\`${r.id}\`](${r.helpUrl})`).join(', ');
    const found = axeFindings(
      summary,
      rules.running.map((r) => r.id),
    );
    const result = found
      ? `serious or critical: ${findingsText(found.blocking)}; lower impact: ${findingsText(found.other)}; left to review by hand: ${findingsText(found.review)}`
      : 'not recorded (no full run yet)';
    lines.push(
      `- axe ${names}. Views: every page and frame the axe suites scan (${summary ? plural(summary.axe.scans, 'scan') : 'see appendix B'}). Last run: ${result}.`,
    );
  }
  if (rules.notRunning.length)
    lines.push(
      `- axe also has ${rules.notRunning.map((r) => `\`${r.id}\` (${r.keptOutBy ?? 'not in the suite’s tags'})`).join(', ')} for this criterion; axe leaves such rules out by default, so the suite does not run them.`,
    );
  return lines;
}

/**
 * Writes one criterion's section.
 * @param {{id: string, name: string, level: string, since: string, slug: string}} criterion - From CRITERIA.
 * @param {{checks: object[], protocol: string[], note?: string}} evidence - Its entry in the evidence map.
 * @param {{index: object[], summary: object | undefined, axeIndex: object, protocol: object, register: object,
 *   blocks: Map<string, string>}} ctx - Everything the report is generated from.
 * @returns {string} The section's Markdown, ending without a newline.
 */
export function renderCriterion(criterion, evidence, ctx) {
  const { id } = criterion;
  const blockId = criterionBlockId(id);
  const automated = [
    ...axeLines(rulesOfCriterion(ctx.axeIndex, id), ctx.summary),
    ...evidence.checks.map((check) => checkLine(check, { ...ctx, criterionId: id })),
  ];
  const steps = protocolRefs(evidence, ctx.protocol, id).map((ref) => {
    // WHY: protocolText throws on a step or check the protocol no longer has, also for a §7 check shown by name.
    const text = protocolText(ctx.protocol, ref);
    return ref.startsWith('§7 ') ? ref : `${ref} «${plain(text)}»`;
  });
  const upstream = upstreamLines(ctx.register, ctx.axeIndex, id);
  return [
    `### ${id} ${criterion.name}`,
    '',
    `Level ${criterion.level} · since WCAG ${criterion.since} · [Understanding ${id}](${understandingUrl(criterion)})`,
    '',
    manualBlock(blockId, ctx.blocks.get(blockId)),
    '',
    '**Automated evidence (generated):**',
    '',
    ...(automated.length
      ? automated
      : ['- None. No automated check covers this criterion; it rests on the manual evaluation.']),
    '',
    `**Manual protocol:** ${steps.join('; ') || 'no step names this criterion yet.'}`,
    ...(upstream.length
      ? ['', '**Known H5P upstream barriers (register):**', '', ...upstream.map((l) => `- ${l}`)]
      : []),
    ...(evidence.note ? ['', `**Scope note:** ${evidence.note}`] : []),
  ].join('\n');
}
