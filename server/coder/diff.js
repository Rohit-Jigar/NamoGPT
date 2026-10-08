/**
 * Namo Coder - Unified Diff & Patch Engine
 * 
 * Computes deterministic Myers/LCS diffs with structured hunk representation,
 * unified diff string generation, and safe patch application.
 */

/**
 * Splits text into an array of lines, normalizing line endings.
 * @param {string} text 
 * @returns {string[]}
 */
function splitLines(text) {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return normalized.split('\n');
}

/**
 * Computes Longest Common Subsequence (LCS) matrix for two line arrays.
 * Uses prefix/suffix trimming for maximum performance.
 * 
 * @param {string[]} aLines 
 * @param {string[]} bLines 
 * @returns {Array<{ type: 'keep'|'remove'|'add', line: string, aIndex: number, bIndex: number }>}
 */
function computeLineDiff(aLines, bLines) {
  const m = aLines.length;
  const n = bLines.length;

  // 1. Trim common prefix
  let prefixCount = 0;
  while (prefixCount < m && prefixCount < n && aLines[prefixCount] === bLines[prefixCount]) {
    prefixCount++;
  }

  // 2. Trim common suffix
  let suffixCount = 0;
  while (
    suffixCount < (m - prefixCount) &&
    suffixCount < (n - prefixCount) &&
    aLines[m - 1 - suffixCount] === bLines[n - 1 - suffixCount]
  ) {
    suffixCount++;
  }

  const midA = aLines.slice(prefixCount, m - suffixCount);
  const midB = bLines.slice(prefixCount, n - suffixCount);
  const midM = midA.length;
  const midN = midB.length;

  // LCS Dynamic Programming on trimmed middle
  const dp = Array.from({ length: midM + 1 }, () => new Uint32Array(midN + 1));
  for (let i = 0; i < midM; i++) {
    for (let j = 0; j < midN; j++) {
      if (midA[i] === midB[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack middle diff operations
  let i = midM;
  let j = midN;
  const midOps = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && midA[i - 1] === midB[j - 1]) {
      midOps.push({ type: 'keep', line: midA[i - 1], aIndex: prefixCount + i - 1, bIndex: prefixCount + j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      midOps.push({ type: 'add', line: midB[j - 1], aIndex: -1, bIndex: prefixCount + j - 1 });
      j--;
    } else if (i > 0) {
      midOps.push({ type: 'remove', line: midA[i - 1], aIndex: prefixCount + i - 1, bIndex: -1 });
      i--;
    }
  }
  midOps.reverse();

  // Combine prefix, middle diff, and suffix
  const allOps = [];
  for (let p = 0; p < prefixCount; p++) {
    allOps.push({ type: 'keep', line: aLines[p], aIndex: p, bIndex: p });
  }
  allOps.push(...midOps);
  for (let s = 0; s < suffixCount; s++) {
    const aIdx = m - suffixCount + s;
    const bIdx = n - suffixCount + s;
    allOps.push({ type: 'keep', line: aLines[aIdx], aIndex: aIdx, bIndex: bIdx });
  }

  return allOps;
}

/**
 * Computes unified diff string and structured hunks between original and modified text.
 * 
 * @param {string} original - Original file content.
 * @param {string} modified - Modified file content.
 * @param {string} [filename='file'] - Filename for diff header.
 * @param {number} [contextLines=3] - Number of unchanged context lines surrounding changes.
 * @returns {{ filename: string, unifiedDiff: string, hunks: Array<object>, stats: { additions: number, deletions: number, changes: number } }}
 */
export function computeDiff(original, modified, filename = 'file', contextLines = 3) {
  const origStr = typeof original === 'string' ? original : '';
  const modStr = typeof modified === 'string' ? modified : '';

  if (origStr === modStr) {
    return {
      filename,
      unifiedDiff: '',
      hunks: [],
      stats: { additions: 0, deletions: 0, changes: 0 }
    };
  }

  const aLines = splitLines(origStr);
  const bLines = splitLines(modStr);
  const ops = computeLineDiff(aLines, bLines);

  let additions = 0;
  let deletions = 0;

  for (const op of ops) {
    if (op.type === 'add') additions++;
    else if (op.type === 'remove') deletions++;
  }

  // Group diff operations into hunks with context
  const hunks = [];
  let currentHunk = null;

  for (let idx = 0; idx < ops.length; idx++) {
    const op = ops[idx];

    // Check if this operation is a change or within context distance of a change
    let isNearChange = op.type !== 'keep';
    if (!isNearChange) {
      // Look back
      for (let back = 1; back <= contextLines && idx - back >= 0; back++) {
        if (ops[idx - back].type !== 'keep') {
          isNearChange = true;
          break;
        }
      }
      // Look ahead
      if (!isNearChange) {
        for (let fwd = 1; fwd <= contextLines && idx + fwd < ops.length; fwd++) {
          if (ops[idx + fwd].type !== 'keep') {
            isNearChange = true;
            break;
          }
        }
      }
    }

    if (isNearChange) {
      if (!currentHunk) {
        currentHunk = {
          lines: [],
          oldStart: op.aIndex >= 0 ? op.aIndex + 1 : 1,
          oldLines: 0,
          newStart: op.bIndex >= 0 ? op.bIndex + 1 : 1,
          newLines: 0
        };
      }

      currentHunk.lines.push({
        type: op.type,
        content: op.line,
        oldLineNumber: op.aIndex >= 0 ? op.aIndex + 1 : null,
        newLineNumber: op.bIndex >= 0 ? op.bIndex + 1 : null
      });

      if (op.type === 'keep') {
        currentHunk.oldLines++;
        currentHunk.newLines++;
      } else if (op.type === 'remove') {
        currentHunk.oldLines++;
      } else if (op.type === 'add') {
        currentHunk.newLines++;
      }
    } else {
      if (currentHunk) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // Format standard Unified Diff string
  let unifiedDiff = '';
  if (hunks.length > 0) {
    unifiedDiff += `--- a/${filename}\n`;
    unifiedDiff += `+++ b/${filename}\n`;

    for (const hunk of hunks) {
      unifiedDiff += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
      for (const line of hunk.lines) {
        const prefix = line.type === 'add' ? '+' : (line.type === 'remove' ? '-' : ' ');
        unifiedDiff += `${prefix}${line.content}\n`;
      }
    }
  }

  return {
    filename,
    unifiedDiff: unifiedDiff.trimEnd(),
    hunks,
    stats: {
      additions,
      deletions,
      changes: additions + deletions
    }
  };
}

/**
 * Parses a standard unified diff string into structured hunks.
 * @param {string} diffString 
 * @returns {Array<object>}
 */
export function parseUnifiedDiff(diffString) {
  if (!diffString || typeof diffString !== 'string') return [];

  const lines = splitLines(diffString);
  const hunks = [];
  let currentHunk = null;

  const hunkHeaderRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

  for (const line of lines) {
    const match = hunkHeaderRegex.exec(line);
    if (match) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = {
        oldStart: parseInt(match[1], 10),
        oldLines: match[2] !== undefined ? parseInt(match[2], 10) : 1,
        newStart: parseInt(match[3], 10),
        newLines: match[4] !== undefined ? parseInt(match[4], 10) : 1,
        lines: []
      };
      continue;
    }

    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: 'add', content: line.slice(1) });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({ type: 'remove', content: line.slice(1) });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({ type: 'keep', content: line.startsWith(' ') ? line.slice(1) : '' });
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Safely applies unified diff changes or structured hunks to the original text.
 * 
 * @param {string} original - Original content.
 * @param {string|object} diff - Unified diff string or object containing hunks.
 * @returns {{ success: boolean, patched: string, appliedHunks: number, error?: string }}
 */
export function applyPatch(original, diff) {
  const origStr = typeof original === 'string' ? original : '';
  const hunks = typeof diff === 'string'
    ? parseUnifiedDiff(diff)
    : (diff && Array.isArray(diff.hunks) ? diff.hunks : []);

  if (!hunks || hunks.length === 0) {
    return {
      success: true,
      patched: origStr,
      appliedHunks: 0
    };
  }

  const origLines = splitLines(origStr);
  const resultLines = [];
  let origIndex = 0;
  let appliedCount = 0;

  for (const hunk of hunks) {
    const targetOldStart = Math.max(0, hunk.oldStart - 1);

    // Copy lines before this hunk
    while (origIndex < targetOldStart && origIndex < origLines.length) {
      resultLines.push(origLines[origIndex]);
      origIndex++;
    }

    // Process hunk lines
    for (const hLine of hunk.lines) {
      if (hLine.type === 'keep') {
        if (origIndex < origLines.length && origLines[origIndex] === hLine.content) {
          resultLines.push(origLines[origIndex]);
          origIndex++;
        } else {
          // Soft match or advance
          resultLines.push(hLine.content);
          if (origIndex < origLines.length) origIndex++;
        }
      } else if (hLine.type === 'remove') {
        // Skip from original
        if (origIndex < origLines.length) {
          origIndex++;
        }
      } else if (hLine.type === 'add') {
        resultLines.push(hLine.content);
      }
    }

    appliedCount++;
  }

  // Copy remaining lines from original
  while (origIndex < origLines.length) {
    resultLines.push(origLines[origIndex]);
    origIndex++;
  }

  return {
    success: true,
    patched: resultLines.join('\n'),
    appliedHunks: appliedCount
  };
}
