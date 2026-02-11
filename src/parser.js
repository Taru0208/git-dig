import { execSync } from 'child_process';

const SEPARATOR = '---GIT-DIG-SEP---';

/**
 * Parse git log into structured commits.
 * Uses --numstat for per-file change counts.
 */
export function parseGitLog(repoPath, { since = null, until = null, maxCommits = 5000 } = {}) {
  const args = [
    'git', 'log',
    `--format=${SEPARATOR}%n%H%n%an%n%aI%n%s`,
    '--numstat',
    `--max-count=${maxCommits}`,
  ];

  if (since) args.push(`--since=${since}`);
  if (until) args.push(`--until=${until}`);

  const raw = execSync(args.join(' '), {
    cwd: repoPath,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  return parseRawLog(raw);
}

/**
 * Parse raw git log output into commit objects.
 */
export function parseRawLog(raw) {
  const commits = [];
  const blocks = raw.split(SEPARATOR).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 4) continue;

    const hash = lines[0];
    const author = lines[1];
    const date = lines[2];
    const message = lines[3];

    const files = [];
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split('\t');
      if (parts.length !== 3) continue;

      const [added, deleted, path] = parts;
      // Binary files show '-' for added/deleted
      const isBinary = added === '-' || deleted === '-';
      files.push({
        path,
        added: isBinary ? 0 : parseInt(added, 10),
        deleted: isBinary ? 0 : parseInt(deleted, 10),
        binary: isBinary,
      });
    }

    commits.push({ hash, author, date, message, files });
  }

  return commits;
}
