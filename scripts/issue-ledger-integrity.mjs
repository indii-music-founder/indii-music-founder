const ISSUE_HEADING = /^### ISSUE-(\d+):\s*(.+?)\s*$/gm;
const STATUS = /^- \*\*Status:\*\*\s*(.+)$/m;

export function parseIssueLedger(markdown) {
  const headings = [...markdown.matchAll(ISSUE_HEADING)];
  return headings.map((match, index) => {
    const section = markdown.slice(match.index, headings[index + 1]?.index ?? markdown.length);
    return {
      id: match[1],
      title: match[2],
      status: section.match(STATUS)?.[1] ?? '',
      section,
    };
  });
}

/** Compare against a fresh base so historical duplicates are preserved, never expanded. */
export function validateIssueLedger(baseMarkdown, candidateMarkdown) {
  const base = parseIssueLedger(baseMarkdown);
  const candidate = parseIssueLedger(candidateMarkdown);
  const failures = [];
  const key = issue => `${issue.id}\u0000${issue.title}`;
  const baseCounts = new Map();
  const candidateCounts = new Map();
  const baseIds = new Set(base.map(issue => issue.id));

  for (const issue of base) baseCounts.set(key(issue), (baseCounts.get(key(issue)) ?? 0) + 1);
  for (const issue of candidate) candidateCounts.set(key(issue), (candidateCounts.get(key(issue)) ?? 0) + 1);

  for (const [identity, count] of baseCounts) {
    if ((candidateCounts.get(identity) ?? 0) < count) {
      const [id, title] = identity.split('\u0000');
      failures.push(`ISSUE-${id}: existing finding removed or renamed (${title}).`);
    }
  }

  for (const issue of candidate) {
    const identity = key(issue);
    const priorCount = baseCounts.get(identity) ?? 0;
    const nextCount = candidateCounts.get(identity) ?? 0;
    if (baseIds.has(issue.id) && priorCount === 0) {
      failures.push(`ISSUE-${issue.id}: identifier reused for another finding (${issue.title}).`);
    } else if (nextCount > Math.max(priorCount, 1)) {
      failures.push(`ISSUE-${issue.id}: duplicate finding added (${issue.title}).`);
    }
  }

  // A resolved status must be paired with newly added evidence in that finding.
  for (const issue of candidate) {
    const previous = base.find(entry => key(entry) === key(issue));
    if (!previous) continue;
    const wasResolved = /(?:FIXED|COMPLETED|CLOSED)/i.test(previous.status);
    const isResolved = /(?:FIXED|COMPLETED|CLOSED)/i.test(issue.status);
    const closure = issue.section.match(/^[-*] \*\*Closure evidence:\*\* (.+)$/m)?.[1] ?? '';
    const priorClosure = previous.section.match(/^[-*] \*\*Closure evidence:\*\* (.+)$/m)?.[1] ?? '';
    if (!wasResolved && isResolved &&
        (!/\bcommit [0-9a-f]{7,40}\b/i.test(closure) ||
         !/\bCI https:\/\/github\.com\/[^\s]+\/actions\/runs\/\d+\b/i.test(closure) ||
         closure === priorClosure)) {
      failures.push(`ISSUE-${issue.id}: resolved status needs newly added Closure evidence.`);
    }
  }

  return [...new Set(failures)];
}
