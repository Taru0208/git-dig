/**
 * Hotspot analysis — files that change most frequently
 * and accumulate the most churn (added + deleted lines).
 */
export function hotspots(commits, { top = 20 } = {}) {
  const files = new Map();

  for (const commit of commits) {
    for (const f of commit.files) {
      if (!files.has(f.path)) {
        files.set(f.path, { path: f.path, commits: 0, added: 0, deleted: 0, authors: new Set() });
      }
      const entry = files.get(f.path);
      entry.commits++;
      entry.added += f.added;
      entry.deleted += f.deleted;
      entry.authors.add(commit.author);
    }
  }

  const result = [...files.values()]
    .map(f => ({
      path: f.path,
      commits: f.commits,
      churn: f.added + f.deleted,
      added: f.added,
      deleted: f.deleted,
      authors: f.authors.size,
    }))
    .sort((a, b) => b.commits - a.commits || b.churn - a.churn)
    .slice(0, top);

  return result;
}

/**
 * Temporal coupling — files that change together in the same commit.
 * Only considers commits that touch 2+ files (but not too many, to reduce noise).
 */
export function coupling(commits, { top = 20, minCommits = 3, maxFilesPerCommit = 30 } = {}) {
  const pairs = new Map();
  const fileCounts = new Map();

  for (const commit of commits) {
    const paths = [...new Set(commit.files.map(f => f.path))].sort();
    if (paths.length < 2 || paths.length > maxFilesPerCommit) continue;

    for (const p of paths) {
      fileCounts.set(p, (fileCounts.get(p) || 0) + 1);
    }

    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const key = `${paths[i]}:::${paths[j]}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }

  const result = [...pairs.entries()]
    .filter(([, count]) => count >= minCommits)
    .map(([key, count]) => {
      const [fileA, fileB] = key.split(':::');
      const totalA = fileCounts.get(fileA) || 0;
      const totalB = fileCounts.get(fileB) || 0;
      // Coupling degree: how often they change together relative to their individual change rates
      const degree = count / Math.min(totalA, totalB);
      return { fileA, fileB, coupled: count, degree: Math.round(degree * 100) / 100 };
    })
    .sort((a, b) => b.coupled - a.coupled || b.degree - a.degree)
    .slice(0, top);

  return result;
}

/**
 * Code age — when each file was last modified.
 * Groups files by age bucket.
 */
export function codeAge(commits) {
  const lastModified = new Map();
  const firstSeen = new Map();

  for (const commit of commits) {
    const date = commit.date;
    for (const f of commit.files) {
      if (!firstSeen.has(f.path)) firstSeen.set(f.path, date);
      // commits are ordered newest first, so first occurrence = latest
      if (!lastModified.has(f.path)) lastModified.set(f.path, date);
    }
  }

  const now = new Date();
  const files = [];

  for (const [path, dateStr] of lastModified.entries()) {
    const last = new Date(dateStr);
    const first = new Date(firstSeen.get(path));
    const ageMs = now - last;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    files.push({ path, lastModified: dateStr, firstSeen: firstSeen.get(path), ageDays });
  }

  // Age buckets
  const buckets = { fresh: 0, recent: 0, aging: 0, stale: 0, ancient: 0 };
  for (const f of files) {
    if (f.ageDays <= 7) buckets.fresh++;
    else if (f.ageDays <= 30) buckets.recent++;
    else if (f.ageDays <= 90) buckets.aging++;
    else if (f.ageDays <= 365) buckets.stale++;
    else buckets.ancient++;
  }

  // Top oldest files
  const oldest = [...files].sort((a, b) => b.ageDays - a.ageDays).slice(0, 15);
  // Top freshest files
  const freshest = [...files].sort((a, b) => a.ageDays - b.ageDays).slice(0, 15);

  return { buckets, oldest, freshest, totalFiles: files.length };
}

/**
 * Author contribution analysis.
 */
export function authors(commits, { top = 15 } = {}) {
  const authorMap = new Map();

  for (const commit of commits) {
    if (!authorMap.has(commit.author)) {
      authorMap.set(commit.author, { name: commit.author, commits: 0, added: 0, deleted: 0, files: new Set() });
    }
    const entry = authorMap.get(commit.author);
    entry.commits++;
    for (const f of commit.files) {
      entry.added += f.added;
      entry.deleted += f.deleted;
      entry.files.add(f.path);
    }
  }

  return [...authorMap.values()]
    .map(a => ({
      name: a.name,
      commits: a.commits,
      added: a.added,
      deleted: a.deleted,
      filesChanged: a.files.size,
    }))
    .sort((a, b) => b.commits - a.commits)
    .slice(0, top);
}

/**
 * Knowledge silos — files touched by only one author.
 * Risk: if that person leaves, no one knows the code.
 */
export function knowledgeSilos(commits, { minCommits = 2 } = {}) {
  const fileAuthors = new Map();

  for (const commit of commits) {
    for (const f of commit.files) {
      if (!fileAuthors.has(f.path)) {
        fileAuthors.set(f.path, { authors: new Set(), commits: 0 });
      }
      const entry = fileAuthors.get(f.path);
      entry.authors.add(commit.author);
      entry.commits++;
    }
  }

  const silos = [];
  for (const [path, data] of fileAuthors.entries()) {
    if (data.authors.size === 1 && data.commits >= minCommits) {
      silos.push({
        path,
        author: [...data.authors][0],
        commits: data.commits,
      });
    }
  }

  return silos
    .sort((a, b) => b.commits - a.commits)
    .slice(0, 30);
}

/**
 * Full analysis — runs all analyses and returns combined result.
 */
export function analyzeAll(commits) {
  return {
    summary: {
      totalCommits: commits.length,
      totalAuthors: new Set(commits.map(c => c.author)).size,
      dateRange: commits.length > 0
        ? { from: commits[commits.length - 1].date, to: commits[0].date }
        : null,
    },
    hotspots: hotspots(commits),
    coupling: coupling(commits),
    codeAge: codeAge(commits),
    authors: authors(commits),
    knowledgeSilos: knowledgeSilos(commits),
  };
}
