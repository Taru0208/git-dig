function bar(value, max, width = 20) {
  if (max === 0) return '░'.repeat(width);
  const len = Math.max(1, Math.round((value / max) * width));
  return '█'.repeat(len) + '░'.repeat(width - len);
}

function pad(str, len) {
  return String(str).padStart(len);
}

function truncPath(path, maxLen = 50) {
  if (path.length <= maxLen) return path;
  return '...' + path.slice(-(maxLen - 3));
}

export function formatText(analysis) {
  const lines = [];
  const { summary, hotspots, coupling, codeAge, authors, knowledgeSilos } = analysis;

  // Header
  lines.push('\x1b[1mgit-dig\x1b[0m — repository archaeology');
  lines.push('');
  lines.push(`  ${summary.totalCommits} commits by ${summary.totalAuthors} authors`);
  if (summary.dateRange) {
    lines.push(`  ${summary.dateRange.from.slice(0, 10)} → ${summary.dateRange.to.slice(0, 10)}`);
  }
  lines.push('');

  // Hotspots
  if (hotspots.length > 0) {
    const maxCommits = hotspots[0].commits;
    lines.push('\x1b[1m🔥 Hotspots\x1b[0m (most frequently changed files)');
    lines.push('');
    for (const h of hotspots.slice(0, 15)) {
      lines.push(`  ${bar(h.commits, maxCommits, 15)} ${pad(h.commits, 4)} commits  ${pad(h.churn, 6)} churn  ${truncPath(h.path)}`);
    }
    lines.push('');
  }

  // Coupling
  if (coupling.length > 0) {
    lines.push('\x1b[1m🔗 Temporal Coupling\x1b[0m (files that change together)');
    lines.push('');
    for (const c of coupling.slice(0, 10)) {
      lines.push(`  ${pad(c.coupled, 3)}× (${pad(Math.round(c.degree * 100), 3)}%)  ${truncPath(c.fileA, 35)} ↔ ${truncPath(c.fileB, 35)}`);
    }
    lines.push('');
  }

  // Code Age
  if (codeAge) {
    const { buckets, totalFiles } = codeAge;
    lines.push('\x1b[1m📅 Code Age\x1b[0m');
    lines.push('');
    lines.push(`  fresh (≤7d):    ${pad(buckets.fresh, 4)}  ${bar(buckets.fresh, totalFiles, 15)}`);
    lines.push(`  recent (≤30d):  ${pad(buckets.recent, 4)}  ${bar(buckets.recent, totalFiles, 15)}`);
    lines.push(`  aging (≤90d):   ${pad(buckets.aging, 4)}  ${bar(buckets.aging, totalFiles, 15)}`);
    lines.push(`  stale (≤1y):    ${pad(buckets.stale, 4)}  ${bar(buckets.stale, totalFiles, 15)}`);
    lines.push(`  ancient (>1y):  ${pad(buckets.ancient, 4)}  ${bar(buckets.ancient, totalFiles, 15)}`);
    lines.push('');
  }

  // Authors
  if (authors.length > 0) {
    const maxAuthorCommits = authors[0].commits;
    lines.push('\x1b[1m👤 Authors\x1b[0m');
    lines.push('');
    for (const a of authors.slice(0, 10)) {
      lines.push(`  ${bar(a.commits, maxAuthorCommits, 12)} ${pad(a.commits, 4)} commits  ${pad(a.filesChanged, 4)} files  ${a.name}`);
    }
    lines.push('');
  }

  // Knowledge Silos
  if (knowledgeSilos.length > 0) {
    lines.push('\x1b[1m⚠ Knowledge Silos\x1b[0m (files with only one author)');
    lines.push('');
    for (const s of knowledgeSilos.slice(0, 10)) {
      lines.push(`  ${pad(s.commits, 3)} commits  ${s.author.padEnd(20)}  ${truncPath(s.path)}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function formatMarkdown(analysis) {
  const lines = [];
  const { summary, hotspots, coupling, codeAge, authors, knowledgeSilos } = analysis;

  lines.push('# git-dig — Repository Archaeology');
  lines.push('');
  lines.push(`${summary.totalCommits} commits by ${summary.totalAuthors} authors`);
  if (summary.dateRange) {
    lines.push(`${summary.dateRange.from.slice(0, 10)} to ${summary.dateRange.to.slice(0, 10)}`);
  }
  lines.push('');

  // Hotspots
  if (hotspots.length > 0) {
    lines.push('## Hotspots');
    lines.push('');
    lines.push('| File | Commits | Churn | Authors |');
    lines.push('| --- | ---: | ---: | ---: |');
    for (const h of hotspots) {
      lines.push(`| ${h.path} | ${h.commits} | ${h.churn} | ${h.authors} |`);
    }
    lines.push('');
  }

  // Coupling
  if (coupling.length > 0) {
    lines.push('## Temporal Coupling');
    lines.push('');
    lines.push('| File A | File B | Co-changes | Degree |');
    lines.push('| --- | --- | ---: | ---: |');
    for (const c of coupling) {
      lines.push(`| ${c.fileA} | ${c.fileB} | ${c.coupled} | ${Math.round(c.degree * 100)}% |`);
    }
    lines.push('');
  }

  // Code Age
  if (codeAge) {
    const { buckets } = codeAge;
    lines.push('## Code Age Distribution');
    lines.push('');
    lines.push('| Age | Files |');
    lines.push('| --- | ---: |');
    lines.push(`| Fresh (≤7 days) | ${buckets.fresh} |`);
    lines.push(`| Recent (≤30 days) | ${buckets.recent} |`);
    lines.push(`| Aging (≤90 days) | ${buckets.aging} |`);
    lines.push(`| Stale (≤1 year) | ${buckets.stale} |`);
    lines.push(`| Ancient (>1 year) | ${buckets.ancient} |`);
    lines.push('');
  }

  // Authors
  if (authors.length > 0) {
    lines.push('## Authors');
    lines.push('');
    lines.push('| Author | Commits | Added | Deleted | Files |');
    lines.push('| --- | ---: | ---: | ---: | ---: |');
    for (const a of authors) {
      lines.push(`| ${a.name} | ${a.commits} | +${a.added} | -${a.deleted} | ${a.filesChanged} |`);
    }
    lines.push('');
  }

  // Knowledge Silos
  if (knowledgeSilos.length > 0) {
    lines.push('## Knowledge Silos');
    lines.push('');
    lines.push('| File | Author | Commits |');
    lines.push('| --- | --- | ---: |');
    for (const s of knowledgeSilos) {
      lines.push(`| ${s.path} | ${s.author} | ${s.commits} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Generated by git-dig at ${new Date().toISOString().slice(0, 16)}*`);

  return lines.join('\n');
}

export function formatJson(analysis) {
  return JSON.stringify(analysis, null, 2);
}
