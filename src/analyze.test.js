import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRawLog } from './parser.js';
import { hotspots, coupling, codeAge, authors, knowledgeSilos, analyzeAll } from './analyze.js';
import { formatText, formatMarkdown, formatJson } from './format.js';

// --- Test data ---

const RAW_LOG = `---GIT-DIG-SEP---
abc1234
Alice
2026-02-10T10:00:00+09:00
Add feature X
5\t2\tsrc/app.js
10\t0\tsrc/utils.js
---GIT-DIG-SEP---
def5678
Bob
2026-02-09T14:00:00+09:00
Fix bug in app
3\t1\tsrc/app.js
1\t1\tREADME.md
---GIT-DIG-SEP---
ghi9012
Alice
2026-02-08T09:00:00+09:00
Refactor utils
0\t5\tsrc/utils.js
15\t0\tsrc/utils.js
2\t0\tsrc/app.js
---GIT-DIG-SEP---
jkl3456
Alice
2026-02-07T08:00:00+09:00
Initial commit
50\t0\tsrc/app.js
30\t0\tsrc/utils.js
10\t0\tREADME.md
---GIT-DIG-SEP---
mno7890
Bob
2026-02-06T16:00:00+09:00
Add tests
20\t0\tsrc/app.test.js
5\t2\tsrc/app.js
---GIT-DIG-SEP---
pqr1234
Alice
2026-02-05T12:00:00+09:00
Config update
3\t1\tconfig.json
---GIT-DIG-SEP---
stu5678
Alice
2026-02-04T11:00:00+09:00
More config
2\t1\tconfig.json
1\t0\tsrc/app.js
`;

// --- Parser tests ---

describe('parseRawLog', () => {
  it('should parse commits correctly', () => {
    const commits = parseRawLog(RAW_LOG);
    assert.equal(commits.length, 7);
    assert.equal(commits[0].hash, 'abc1234');
    assert.equal(commits[0].author, 'Alice');
    assert.equal(commits[0].message, 'Add feature X');
    assert.equal(commits[0].files.length, 2);
  });

  it('should parse file stats', () => {
    const commits = parseRawLog(RAW_LOG);
    const firstFile = commits[0].files[0];
    assert.equal(firstFile.path, 'src/app.js');
    assert.equal(firstFile.added, 5);
    assert.equal(firstFile.deleted, 2);
    assert.equal(firstFile.binary, false);
  });

  it('should handle binary files', () => {
    const raw = `---GIT-DIG-SEP---
aaa1111
Alice
2026-01-01T00:00:00+00:00
Add image
-\t-\tlogo.png
5\t0\tREADME.md
`;
    const commits = parseRawLog(raw);
    assert.equal(commits[0].files[0].binary, true);
    assert.equal(commits[0].files[0].added, 0);
    assert.equal(commits[0].files[0].deleted, 0);
    assert.equal(commits[0].files[1].binary, false);
  });

  it('should return empty array for empty input', () => {
    const commits = parseRawLog('');
    assert.equal(commits.length, 0);
  });
});

// --- Hotspot tests ---

describe('hotspots', () => {
  it('should rank by commit frequency', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = hotspots(commits);
    assert.equal(result[0].path, 'src/app.js'); // 6 commits
    assert.equal(result[0].commits, 6);
  });

  it('should calculate churn correctly', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = hotspots(commits);
    const app = result.find(r => r.path === 'src/app.js');
    // app.js: (5+2) + (3+1) + (2+0) + (50+0) + (5+2) + (1+0) = 71
    assert.equal(app.churn, 71);
  });

  it('should count unique authors', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = hotspots(commits);
    const app = result.find(r => r.path === 'src/app.js');
    assert.equal(app.authors, 2); // Alice and Bob
  });

  it('should respect top parameter', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = hotspots(commits, { top: 2 });
    assert.equal(result.length, 2);
  });
});

// --- Coupling tests ---

describe('coupling', () => {
  it('should detect files that change together', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = coupling(commits, { minCommits: 1 });
    assert.ok(result.length > 0);
    // src/app.js and src/utils.js change together in commits abc1234 and ghi9012
    const pair = result.find(
      c => (c.fileA === 'src/app.js' && c.fileB === 'src/utils.js') ||
           (c.fileA === 'src/utils.js' && c.fileB === 'src/app.js')
    );
    assert.ok(pair, 'app.js and utils.js should be coupled');
    assert.equal(pair.coupled, 3);
  });

  it('should calculate coupling degree', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = coupling(commits, { minCommits: 1 });
    for (const c of result) {
      assert.ok(c.degree >= 0 && c.degree <= 1, `degree should be 0-1, got ${c.degree}`);
    }
  });

  it('should filter by minCommits', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = coupling(commits, { minCommits: 5 });
    assert.equal(result.length, 0); // no pair has 5+ co-changes
  });
});

// --- Code Age tests ---

describe('codeAge', () => {
  it('should compute age buckets', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = codeAge(commits);
    assert.ok(result.buckets);
    const total = Object.values(result.buckets).reduce((a, b) => a + b, 0);
    assert.equal(total, result.totalFiles);
  });

  it('should track oldest and freshest files', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = codeAge(commits);
    assert.ok(result.oldest.length > 0);
    assert.ok(result.freshest.length > 0);
    // oldest should have higher ageDays than freshest
    assert.ok(result.oldest[0].ageDays >= result.freshest[0].ageDays);
  });
});

// --- Author tests ---

describe('authors', () => {
  it('should rank authors by commits', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = authors(commits);
    assert.equal(result[0].name, 'Alice'); // 5 commits
    assert.equal(result[0].commits, 5);
    assert.equal(result[1].name, 'Bob'); // 2 commits
    assert.equal(result[1].commits, 2);
  });

  it('should count files touched', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = authors(commits);
    const alice = result.find(a => a.name === 'Alice');
    // Alice touched: src/app.js, src/utils.js, README.md, config.json
    assert.equal(alice.filesChanged, 4);
  });
});

// --- Knowledge Silos tests ---

describe('knowledgeSilos', () => {
  it('should find single-author files', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = knowledgeSilos(commits, { minCommits: 1 });
    // config.json: only Alice (2 commits)
    const config = result.find(s => s.path === 'config.json');
    assert.ok(config, 'config.json should be a silo');
    assert.equal(config.author, 'Alice');
  });

  it('should not flag multi-author files', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = knowledgeSilos(commits, { minCommits: 1 });
    // src/app.js is touched by both Alice and Bob
    const app = result.find(s => s.path === 'src/app.js');
    assert.equal(app, undefined, 'app.js should not be a silo');
  });

  it('should respect minCommits', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = knowledgeSilos(commits, { minCommits: 3 });
    // Only src/utils.js (3 commits by Alice) qualifies
    const config = result.find(s => s.path === 'config.json');
    assert.equal(config, undefined, 'config.json has only 2 commits');
  });
});

// --- analyzeAll tests ---

describe('analyzeAll', () => {
  it('should return all sections', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = analyzeAll(commits);
    assert.ok(result.summary);
    assert.ok(result.hotspots);
    assert.ok(result.coupling);
    assert.ok(result.codeAge);
    assert.ok(result.authors);
    assert.ok(result.knowledgeSilos);
  });

  it('should compute correct summary', () => {
    const commits = parseRawLog(RAW_LOG);
    const result = analyzeAll(commits);
    assert.equal(result.summary.totalCommits, 7);
    assert.equal(result.summary.totalAuthors, 2);
  });

  it('should handle empty commits', () => {
    const result = analyzeAll([]);
    assert.equal(result.summary.totalCommits, 0);
    assert.equal(result.hotspots.length, 0);
  });
});

// --- Formatter tests ---

describe('formatText', () => {
  it('should produce readable output', () => {
    const commits = parseRawLog(RAW_LOG);
    const analysis = analyzeAll(commits);
    const text = formatText(analysis);
    assert.ok(text.includes('git-dig'));
    assert.ok(text.includes('Hotspots'));
    assert.ok(text.includes('src/app.js'));
  });
});

describe('formatMarkdown', () => {
  it('should produce valid markdown tables', () => {
    const commits = parseRawLog(RAW_LOG);
    const analysis = analyzeAll(commits);
    const md = formatMarkdown(analysis);
    assert.ok(md.includes('| File | Commits |'));
    assert.ok(md.includes('src/app.js'));
  });
});

describe('formatJson', () => {
  it('should produce valid JSON', () => {
    const commits = parseRawLog(RAW_LOG);
    const analysis = analyzeAll(commits);
    const json = formatJson(analysis);
    const parsed = JSON.parse(json);
    assert.equal(parsed.summary.totalCommits, 7);
  });
});
