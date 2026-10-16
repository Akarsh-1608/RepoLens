import crypto from 'crypto';

// Maximum chunk size in characters (~500 tokens)
const MAX_CHUNK_CHARS = 1500;
const MIN_CHUNK_CHARS = 100;
// Overlap between chunks (chars)
const CHUNK_OVERLAP = 200;

// Patterns for function/class detection
const FUNCTION_PATTERNS = [
  // JavaScript/TypeScript
  /^(export\s+)?(async\s+)?function\s+\w+/,
  /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(/,
  /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?function/,
  /^(export\s+)?class\s+\w+/,
  // Python
  /^(async\s+)?def\s+\w+/,
  /^class\s+\w+/,
  // Java/C++/C#/Go
  /^(public|private|protected|static|abstract|override|async).*\w+\s*\(/,
  /^func\s+\w+/,
  /^fn\s+\w+/,
];

function isSemanticBoundary(line) {
  const trimmed = line.trimStart();
  return FUNCTION_PATTERNS.some((p) => p.test(trimmed));
}

function computeHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Split file content into meaningful chunks, preserving line numbers.
 * Tries to split at function/class boundaries when possible.
 * Falls back to fixed-size text splitting.
 */
export function chunkContent(content, filePath, language) {
  const lines = content.split('\n');
  const chunks = [];

  if (!content.trim() || lines.length === 0) {
    return chunks;
  }

  // For very small files, return as single chunk
  if (content.length <= MAX_CHUNK_CHARS) {
    chunks.push({
      chunkIndex: 0,
      startLine: 1,
      endLine: lines.length,
      content: content.trim(),
      contentHash: computeHash(content.trim()),
    });
    return chunks;
  }

  // Find semantic boundary lines (function/class starts)
  const boundaries = [0];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && isSemanticBoundary(lines[i])) {
      boundaries.push(i);
    }
  }
  boundaries.push(lines.length);

  // Build chunks from semantic sections
  let rawChunks = [];
  let currentChunkLines = [];
  let currentChunkStart = 0;
  let currentSize = 0;

  for (let b = 0; b < boundaries.length - 1; b++) {
    const sectionStart = boundaries[b];
    const sectionEnd = boundaries[b + 1];
    const sectionLines = lines.slice(sectionStart, sectionEnd);
    const sectionContent = sectionLines.join('\n');
    const sectionSize = sectionContent.length;

    if (currentSize + sectionSize > MAX_CHUNK_CHARS && currentChunkLines.length > 0) {
      // Flush current chunk
      rawChunks.push({
        lines: currentChunkLines,
        startLine: currentChunkStart + 1,
      });
      // Start new chunk with overlap
      const overlapLines = currentChunkLines.slice(-Math.floor(currentChunkLines.length * 0.15));
      currentChunkLines = [...overlapLines, ...sectionLines];
      currentChunkStart = sectionStart - overlapLines.length;
      currentSize = currentChunkLines.join('\n').length;
    } else {
      if (currentChunkLines.length === 0) currentChunkStart = sectionStart;
      currentChunkLines.push(...sectionLines);
      currentSize += sectionSize;
    }
  }

  if (currentChunkLines.length > 0) {
    rawChunks.push({
      lines: currentChunkLines,
      startLine: currentChunkStart + 1,
    });
  }

  // If semantic chunking produced 0 or 1 chunk that's still too large, fall back
  if (rawChunks.length <= 1 && content.length > MAX_CHUNK_CHARS) {
    rawChunks = textSplitChunks(lines);
  }

  // Build final chunk objects
  for (let i = 0; i < rawChunks.length; i++) {
    const raw = rawChunks[i];
    const chunkContent = raw.lines.join('\n').trim();
    
    if (chunkContent.length < MIN_CHUNK_CHARS) continue;

    const endLine = raw.startLine + raw.lines.length - 1;
    chunks.push({
      chunkIndex: i,
      startLine: raw.startLine,
      endLine: Math.min(endLine, lines.length),
      content: chunkContent,
      contentHash: computeHash(chunkContent),
    });
  }

  return chunks;
}

function textSplitChunks(lines) {
  const chunks = [];
  let startIdx = 0;

  while (startIdx < lines.length) {
    let charCount = 0;
    let endIdx = startIdx;

    while (endIdx < lines.length && charCount + lines[endIdx].length < MAX_CHUNK_CHARS) {
      charCount += lines[endIdx].length + 1;
      endIdx++;
    }

    if (endIdx === startIdx) endIdx = startIdx + 1; // Avoid infinite loop

    chunks.push({
      lines: lines.slice(startIdx, endIdx),
      startLine: startIdx + 1,
    });

    if (endIdx >= lines.length) {
      break;
    }

    // Overlap: go back by ~15% of processed lines, but guarantee forward progress
    const overlap = Math.max(1, Math.floor((endIdx - startIdx) * 0.15));
    const nextStart = endIdx - overlap;
    startIdx = nextStart > startIdx ? nextStart : endIdx;
  }

  return chunks;
}
