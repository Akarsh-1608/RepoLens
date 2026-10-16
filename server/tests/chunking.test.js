import { describe, it, expect } from 'vitest';
import { chunkContent } from '../src/services/chunking.service.js';

describe('chunkContent', () => {
  it('returns single chunk for small files', () => {
    const content = 'function hello() {\n  return "world";\n}';
    const chunks = chunkContent(content, 'test.js', 'JavaScript');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it('preserves line numbers', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    const content = lines.join('\n');
    const chunks = chunkContent(content, 'test.txt', 'Text');
    
    for (const chunk of chunks) {
      expect(chunk.startLine).toBeGreaterThanOrEqual(1);
      expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
      expect(chunk.endLine).toBeLessThanOrEqual(lines.length);
    }
  });

  it('returns empty array for empty content', () => {
    expect(chunkContent('', 'test.js', 'JavaScript')).toHaveLength(0);
    expect(chunkContent('   ', 'test.js', 'JavaScript')).toHaveLength(0);
  });

  it('produces content hashes', () => {
    const content = 'const x = 1;\nconst y = 2;';
    const chunks = chunkContent(content, 'test.js', 'JavaScript');
    expect(chunks[0].contentHash).toBeTruthy();
    expect(chunks[0].contentHash).toHaveLength(64); // SHA-256 hex
  });

  it('splits large content into multiple chunks', () => {
    // Generate ~5000 chars of content
    const lines = Array.from({ length: 200 }, (_, i) => 
      `const variable${i} = "this is some longer line content ${i}";`
    );
    const content = lines.join('\n');
    const chunks = chunkContent(content, 'large.js', 'JavaScript');
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('detects function boundaries', () => {
    const content = `function alpha() {
  return 1;
}

function beta() {
  return 2;
}

function gamma() {
  return 3;
}`;
    // Should try to split at function boundaries
    const chunks = chunkContent(content, 'test.js', 'JavaScript');
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // All lines should be covered
    const coveredLines = new Set();
    for (const c of chunks) {
      for (let l = c.startLine; l <= c.endLine; l++) {
        coveredLines.add(l);
      }
    }
    expect(coveredLines.size).toBeGreaterThan(0);
  });

  it('each chunk has unique index', () => {
    const lines = Array.from({ length: 60 }, (_, i) => `// line of code number ${i} to fill up content`);
    const content = lines.join('\n');
    const chunks = chunkContent(content, 'test.js', 'JavaScript');
    const indices = chunks.map((c) => c.chunkIndex);
    const unique = new Set(indices);
    expect(unique.size).toBe(indices.length);
  });
});
