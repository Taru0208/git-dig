#!/usr/bin/env node

import { parseGitLog } from './parser.js';
import { analyzeAll, hotspots, coupling, codeAge, authors, knowledgeSilos } from './analyze.js';
import { formatText, formatMarkdown, formatJson } from './format.js';

const HELP = `
git-dig — dig into your git history

Usage:
  git-dig [path] [options]

Options:
  -s, --since <date>    Only commits after this date (e.g. "6 months ago", "2024-01-01")
  -u, --until <date>    Only commits before this date
  -n, --max <N>         Max commits to analyze (default: 5000)
  -m, --markdown        Output as Markdown
  -j, --json            Output as JSON
      --hotspots        Show only hotspots
      --coupling        Show only temporal coupling
      --age             Show only code age
      --authors         Show only author stats
      --silos           Show only knowledge silos
  -h, --help            Show this help

Examples:
  git-dig                         Analyze current repo
  git-dig ./my-project            Analyze specific repo
  git-dig -s "6 months ago"       Last 6 months only
  git-dig --hotspots              Just the hotspots
  git-dig -m > report.md          Markdown report
`.trim();

function parseArgs(argv) {
  const opts = { path: '.', since: null, until: null, maxCommits: 5000, format: 'text', mode: 'all' };
  const args = argv.slice(2);
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case '-h': case '--help':
        console.log(HELP);
        process.exit(0);
      case '-s': case '--since':
        opts.since = args[++i]; break;
      case '-u': case '--until':
        opts.until = args[++i]; break;
      case '-n': case '--max':
        opts.maxCommits = parseInt(args[++i], 10); break;
      case '-m': case '--markdown':
        opts.format = 'markdown'; break;
      case '-j': case '--json':
        opts.format = 'json'; break;
      case '--hotspots':
        opts.mode = 'hotspots'; break;
      case '--coupling':
        opts.mode = 'coupling'; break;
      case '--age':
        opts.mode = 'age'; break;
      case '--authors':
        opts.mode = 'authors'; break;
      case '--silos':
        opts.mode = 'silos'; break;
      default:
        if (!arg.startsWith('-')) opts.path = arg;
        break;
    }
    i++;
  }

  return opts;
}

function run() {
  const opts = parseArgs(process.argv);

  let commits;
  try {
    commits = parseGitLog(opts.path, {
      since: opts.since,
      until: opts.until,
      maxCommits: opts.maxCommits,
    });
  } catch (e) {
    if (e.message.includes('not a git repository')) {
      console.error('Error: not a git repository. Run git-dig inside a git repo or pass a path.');
    } else {
      console.error(`Error: ${e.message}`);
    }
    process.exit(1);
  }

  if (commits.length === 0) {
    console.error('No commits found in the specified range.');
    process.exit(1);
  }

  const analysis = analyzeAll(commits);

  // Filter to specific mode if requested
  if (opts.mode !== 'all') {
    const filtered = { summary: analysis.summary };
    filtered[opts.mode === 'silos' ? 'knowledgeSilos' : opts.mode] =
      analysis[opts.mode === 'silos' ? 'knowledgeSilos' : opts.mode === 'age' ? 'codeAge' : opts.mode];
    // Fill missing sections with empty so formatters don't crash
    const full = {
      summary: analysis.summary,
      hotspots: [],
      coupling: [],
      codeAge: null,
      authors: [],
      knowledgeSilos: [],
      ...filtered,
    };
    output(full, opts.format);
  } else {
    output(analysis, opts.format);
  }
}

function output(analysis, format) {
  switch (format) {
    case 'markdown': console.log(formatMarkdown(analysis)); break;
    case 'json': console.log(formatJson(analysis)); break;
    default: console.log(formatText(analysis)); break;
  }
}

run();
