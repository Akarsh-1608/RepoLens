import axios from 'axios';
import { config } from '../config.js';

// Strict allowlist - only GitHub.com repos
const GITHUB_REPO_PATTERN = /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(\.git)?\/?$/;

// Binary file extensions to skip
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.tiff',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.whl', '.jar', '.war',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.obj', '.class',
  '.pyc', '.pyo', '.pyd',
  '.db', '.sqlite', '.sqlite3',
  '.min.js', '.min.css',
]);

// Directories to skip entirely
const SKIP_DIRS = new Set([
  'node_modules', 'vendor', '.git', '.svn', '.hg',
  '__pycache__', '.pytest_cache', '.mypy_cache',
  'dist', 'build', 'out', '.next', '.nuxt', '.output',
  'coverage', '.nyc_output',
  '.idea', '.vscode', '.vs',
  'venv', '.venv', 'env', '.env',
]);

// Files to skip
const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock',
  'Gemfile.lock', 'poetry.lock', 'Pipfile.lock', 'cargo.lock',
  '.DS_Store', 'Thumbs.db', '.gitignore', '.gitattributes',
]);

function createGitHubClient() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (config.github.token) {
    headers.Authorization = `Bearer ${config.github.token}`;
  }
  return axios.create({
    baseURL: 'https://api.github.com',
    headers,
    timeout: 15000,
  });
}

export function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  const trimmed = url.trim();
  
  // SSRF protection: only allow GitHub.com
  if (!trimmed.startsWith('https://github.com/') && !trimmed.startsWith('http://github.com/')) {
    return { valid: false, error: 'Only public GitHub.com repository URLs are supported' };
  }

  const match = trimmed.match(GITHUB_REPO_PATTERN);
  if (!match) {
    return { valid: false, error: 'Invalid GitHub repository URL format. Expected: https://github.com/owner/repo' };
  }

  const [, owner, name] = match;
  
  // Validate owner/repo names
  if (owner.startsWith('-') || name.startsWith('-')) {
    return { valid: false, error: 'Invalid repository owner or name' };
  }

  return {
    valid: true,
    owner,
    name,
    normalizedUrl: `https://github.com/${owner}/${name}`,
  };
}

export async function fetchRepositoryMetadata(owner, name) {
  const client = createGitHubClient();
  try {
    const response = await client.get(`/repos/${owner}/${name}`);
    const data = response.data;
    
    return {
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      defaultBranch: data.default_branch,
      language: data.language,
      stars: data.stargazers_count,
      forks: data.forks_count,
      private: data.private,
      size: data.size, // KB
      topics: data.topics || [],
      githubUrl: `https://github.com/${data.owner.login}/${data.name}`,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error('Repository not found or is private');
    }
    if (err.response?.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Provide a GITHUB_TOKEN for higher limits.');
    }
    if (err.response?.status === 451) {
      throw new Error('Repository is not accessible due to legal restrictions');
    }
    throw new Error(`GitHub API error: ${err.response?.data?.message || err.message}`);
  }
}

export async function fetchLatestCommitSha(owner, name, branch) {
  const client = createGitHubClient();
  try {
    const response = await client.get(`/repos/${owner}/${name}/commits/${branch}`, {
      params: { per_page: 1 },
    });
    return response.data.sha;
  } catch (err) {
    if (err.response?.status === 409) {
      return null; // Empty repository
    }
    throw new Error(`Failed to fetch commit SHA: ${err.response?.data?.message || err.message}`);
  }
}

export async function fetchFileTree(owner, name, commitSha) {
  const client = createGitHubClient();
  try {
    const response = await client.get(
      `/repos/${owner}/${name}/git/trees/${commitSha}`,
      { params: { recursive: '1' } }
    );

    if (response.data.truncated) {
      console.warn(`[github] File tree truncated for ${owner}/${name} - very large repo`);
    }

    return response.data.tree.filter((item) => item.type === 'blob');
  } catch (err) {
    if (err.response?.status === 409) {
      return []; // Empty repository
    }
    throw new Error(`Failed to fetch file tree: ${err.response?.data?.message || err.message}`);
  }
}

export function shouldSkipFile(filePath, sizeBytes) {
  const parts = filePath.split('/');
  
  // Check if any directory component should be skipped
  for (const part of parts.slice(0, -1)) {
    if (SKIP_DIRS.has(part) || part.startsWith('.')) {
      return { skip: true, reason: `directory: ${part}` };
    }
  }

  const filename = parts[parts.length - 1];

  // Check skip list
  if (SKIP_FILES.has(filename)) {
    return { skip: true, reason: `skip file: ${filename}` };
  }

  // Check binary extensions
  const ext = filename.toLowerCase().match(/(\.[^.]+)$/)?.[1];
  if (ext && BINARY_EXTENSIONS.has(ext)) {
    return { skip: true, reason: `binary extension: ${ext}` };
  }
  
  // Check .min files
  if (filename.match(/\.min\.(js|css)$/)) {
    return { skip: true, reason: 'minified file' };
  }

  // Check file size
  if (sizeBytes > config.github.maxFileSize) {
    return { skip: true, reason: `file too large: ${sizeBytes} bytes (limit: ${config.github.maxFileSize})` };
  }

  return { skip: false };
}

export async function fetchFileContent(owner, name, filePath, commitSha) {
  const client = createGitHubClient();
  try {
    const response = await client.get(`/repos/${owner}/${name}/contents/${filePath}`, {
      params: { ref: commitSha },
      headers: { Accept: 'application/vnd.github.raw+json' },
    });

    // Raw content response
    if (typeof response.data === 'string') {
      return response.data;
    }
    
    // JSON response with base64 content
    if (response.data.content) {
      const content = Buffer.from(response.data.content, 'base64').toString('utf8');
      // Verify it's valid UTF-8 text
      if (content.includes('\0')) {
        return null; // Binary file
      }
      return content;
    }

    return null;
  } catch (err) {
    if (err.response?.status === 404) {
      return null;
    }
    if (err.response?.status === 403 && err.response?.data?.message?.includes('too large')) {
      return null;
    }
    throw err;
  }
}

// Bounded concurrency file fetcher
export async function fetchFilesWithConcurrency(owner, name, filePaths, commitSha, concurrency = 5) {
  const results = new Map();
  const queue = [...filePaths];
  let inFlight = 0;
  let errors = 0;

  return new Promise((resolve, reject) => {
    function scheduleNext() {
      while (inFlight < concurrency && queue.length > 0) {
        const filePath = queue.shift();
        inFlight++;

        fetchFileContent(owner, name, filePath, commitSha)
          .then((content) => {
            if (content !== null) {
              results.set(filePath, content);
            }
          })
          .catch((err) => {
            errors++;
            if (err.response?.status === 403) {
              // Rate limit hit - drain the queue
              console.warn(`[github] Rate limit hit fetching ${filePath}`);
              queue.length = 0;
            } else {
              console.warn(`[github] Error fetching ${filePath}:`, err.message);
            }
          })
          .finally(() => {
            inFlight--;
            if (queue.length === 0 && inFlight === 0) {
              resolve({ results, errors });
            } else {
              scheduleNext();
            }
          });
      }
    }

    if (queue.length === 0) {
      resolve({ results, errors: 0 });
      return;
    }

    scheduleNext();
  });
}

export function detectLanguage(filePath) {
  const ext = filePath.toLowerCase().match(/\.([^.]+)$/)?.[1];
  const langMap = {
    js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
    ts: 'TypeScript', tsx: 'TypeScript',
    py: 'Python',
    rb: 'Ruby',
    java: 'Java',
    go: 'Go',
    rs: 'Rust',
    cpp: 'C++', cc: 'C++', cxx: 'C++', hpp: 'C++',
    c: 'C', h: 'C',
    cs: 'C#',
    php: 'PHP',
    swift: 'Swift',
    kt: 'Kotlin',
    scala: 'Scala',
    sh: 'Shell', bash: 'Shell', zsh: 'Shell',
    sql: 'SQL',
    html: 'HTML', htm: 'HTML',
    css: 'CSS', scss: 'CSS', sass: 'CSS', less: 'CSS',
    json: 'JSON',
    yaml: 'YAML', yml: 'YAML',
    toml: 'TOML',
    xml: 'XML',
    md: 'Markdown', mdx: 'Markdown',
    txt: 'Text',
    dockerfile: 'Dockerfile',
    makefile: 'Makefile',
    r: 'R',
    lua: 'Lua',
    dart: 'Dart',
    vue: 'Vue',
    svelte: 'Svelte',
    graphql: 'GraphQL', gql: 'GraphQL',
    proto: 'Protobuf',
    tf: 'Terraform', hcl: 'HCL',
  };
  return langMap[ext] || null;
}
