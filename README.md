# git-dig

Dig into your git history. Find hotspots, temporal coupling, code age, knowledge silos, and author patterns — all from `git log`.

Zero dependencies. Works with any git repository.

## Install

```bash
npx git-dig            # run directly
npm i -g git-dig       # or install globally
```

## Usage

```bash
git-dig                         # analyze current repo
git-dig ./path/to/repo          # analyze specific repo
git-dig -s "6 months ago"       # last 6 months only
git-dig --hotspots              # just the hotspots
git-dig -m > report.md          # export as markdown
git-dig -g > coupling.md        # Mermaid coupling graph
git-dig -j | jq '.hotspots'    # pipe JSON to jq
```

## What it finds

### Hotspots
Files that change most frequently and accumulate the most churn (lines added + deleted). High-churn files are often where bugs live.

### Temporal Coupling
Files that change together in the same commit. Hidden dependencies — if you change file A, you probably need to change file B too.

### Code Age
Distribution of how recently files were modified. Ancient files may be stable infrastructure or forgotten code.

### Authors
Who contributes most, and how their work is distributed across files.

### Knowledge Silos
Files touched by only one author. Risk: if that person leaves, no one knows the code.

## Options

| Flag | Description |
| --- | --- |
| `-s, --since <date>` | Only commits after this date |
| `-u, --until <date>` | Only commits before this date |
| `-n, --max <N>` | Max commits to analyze (default: 5000) |
| `-m, --markdown` | Output as Markdown |
| `-j, --json` | Output as JSON |
| `-g, --graph` | Coupling graph as Mermaid diagram |
| `--hotspots` | Show only hotspots |
| `--coupling` | Show only temporal coupling |
| `--age` | Show only code age |
| `--authors` | Show only author stats |
| `--silos` | Show only knowledge silos |
| `-h, --help` | Show help |

## Example output

```
git-dig — repository archaeology

  1739 commits by 230 authors
  2013-12-10 → 2026-02-10

🔥 Hotspots (most frequently changed files)

  ███████████████  876 commits    2289 churn  package.json
  ██████████████░  835 commits    5730 churn  History.md
  ██░░░░░░░░░░░░░  128 commits    3539 churn  lib/response.js
  █░░░░░░░░░░░░░░   87 commits    1015 churn  .github/workflows/ci.yml

🔗 Temporal Coupling (files that change together)

  621× ( 92%)  History.md ↔ package.json
  103× ( 90%)  History.md ↔ lib/response.js

📅 Code Age

  fresh (≤7d):       4
  recent (≤30d):    13
  ancient (>1y):   271

👤 Authors

  ████████████ 1208 commits   270 files  Douglas Christopher Wilson
  █░░░░░░░░░░░   45 commits    17 files  Wes Todd

⚠ Knowledge Silos (files with only one author)

    8 commits  Douglas Christopher Wilson  lib/middleware/query.js
```

## Programmatic API

```javascript
import { parseGitLog, analyzeAll, formatText } from 'git-dig';

const commits = parseGitLog('/path/to/repo', { since: '6 months ago' });
const analysis = analyzeAll(commits);
console.log(formatText(analysis));

// Or use individual analyses
import { hotspots, coupling, codeAge } from 'git-dig';
const hot = hotspots(commits, { top: 10 });
const coupled = coupling(commits, { minCommits: 5 });
```

## Background

Inspired by Adam Tornhill's [code-maat](https://github.com/adamtornhill/code-maat) and the book *Your Code as a Crime Scene*. This tool brings the same ideas to a lightweight, zero-dependency Node.js CLI.

## License

MIT
