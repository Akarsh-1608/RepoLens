import { describe, it, expect } from 'vitest';
import { parseGitHubUrl } from '../src/services/github.service.js';
import { shouldSkipFile } from '../src/services/github.service.js';

describe('parseGitHubUrl', () => {
  it('parses valid GitHub URL', () => {
    const result = parseGitHubUrl('https://github.com/expressjs/express');
    expect(result.valid).toBe(true);
    expect(result.owner).toBe('expressjs');
    expect(result.name).toBe('express');
    expect(result.normalizedUrl).toBe('https://github.com/expressjs/express');
  });

  it('parses URL with .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/expressjs/express.git');
    expect(result.valid).toBe(true);
    expect(result.name).toBe('express');
  });

  it('parses URL with trailing slash', () => {
    const result = parseGitHubUrl('https://github.com/expressjs/express/');
    expect(result.valid).toBe(true);
  });

  it('rejects non-GitHub URLs', () => {
    expect(parseGitHubUrl('https://gitlab.com/user/repo').valid).toBe(false);
    expect(parseGitHubUrl('https://bitbucket.org/user/repo').valid).toBe(false);
    expect(parseGitHubUrl('https://evil.com/github.com/user/repo').valid).toBe(false);
  });

  it('rejects SSRF attempts', () => {
    expect(parseGitHubUrl('http://localhost/user/repo').valid).toBe(false);
    expect(parseGitHubUrl('http://169.254.169.254/user/repo').valid).toBe(false);
    expect(parseGitHubUrl('file:///etc/passwd').valid).toBe(false);
  });

  it('rejects missing owner or repo', () => {
    expect(parseGitHubUrl('https://github.com/').valid).toBe(false);
    expect(parseGitHubUrl('https://github.com/owner').valid).toBe(false);
  });

  it('rejects null/undefined/empty', () => {
    expect(parseGitHubUrl(null).valid).toBe(false);
    expect(parseGitHubUrl('').valid).toBe(false);
    expect(parseGitHubUrl(undefined).valid).toBe(false);
  });

  it('trims whitespace', () => {
    const result = parseGitHubUrl('  https://github.com/expressjs/express  ');
    expect(result.valid).toBe(true);
  });
});

describe('shouldSkipFile', () => {
  it('skips node_modules', () => {
    expect(shouldSkipFile('node_modules/axios/index.js', 100).skip).toBe(true);
  });

  it('skips binary extensions', () => {
    expect(shouldSkipFile('assets/logo.png', 100).skip).toBe(true);
    expect(shouldSkipFile('data/model.bin', 100).skip).toBe(true);
    expect(shouldSkipFile('fonts/Inter.woff2', 100).skip).toBe(true);
  });

  it('skips lockfiles', () => {
    expect(shouldSkipFile('package-lock.json', 100).skip).toBe(true);
    expect(shouldSkipFile('yarn.lock', 100).skip).toBe(true);
  });

  it('skips oversized files', () => {
    const bigSize = 200 * 1024; // 200KB > default 100KB limit
    expect(shouldSkipFile('src/bigfile.js', bigSize).skip).toBe(true);
  });

  it('skips minified files', () => {
    expect(shouldSkipFile('dist/bundle.min.js', 100).skip).toBe(true);
  });

  it('allows normal source files', () => {
    expect(shouldSkipFile('src/index.js', 1000).skip).toBe(false);
    expect(shouldSkipFile('lib/utils.py', 5000).skip).toBe(false);
    expect(shouldSkipFile('README.md', 2000).skip).toBe(false);
  });

  it('skips hidden directories', () => {
    expect(shouldSkipFile('.github/workflows/ci.yml', 100).skip).toBe(true);
  });

  it('skips dist/build dirs', () => {
    expect(shouldSkipFile('dist/index.js', 100).skip).toBe(true);
    expect(shouldSkipFile('build/app.js', 100).skip).toBe(true);
  });
});
