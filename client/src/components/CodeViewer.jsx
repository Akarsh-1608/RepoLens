import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ExternalLink, Copy, Check, AlertCircle } from 'lucide-react';
import { filesApi } from '../services/api.js';
import { Skeleton } from './ui/index.jsx';
import toast from 'react-hot-toast';

const LANG_MAP = {
  JavaScript: 'javascript', TypeScript: 'typescript', Python: 'python',
  Ruby: 'ruby', Java: 'java', Go: 'go', Rust: 'rust', 'C++': 'cpp',
  C: 'c', 'C#': 'csharp', PHP: 'php', Swift: 'swift', Kotlin: 'kotlin',
  SQL: 'sql', HTML: 'html', CSS: 'css', JSON: 'json', YAML: 'yaml',
  Shell: 'bash', Markdown: 'markdown', GraphQL: 'graphql',
};

export default function CodeViewer({ file, repo, highlightLines }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!file?.path) return;
    
    // If we already have content embedded (e.g. from search result)
    if (file.content) {
      setContent(file.content);
      return;
    }

    setLoading(true);
    setError(null);
    filesApi.get(file.path.startsWith('/') ? file.path.slice(1) : '', file.path)
      .then((data) => setContent(data.file?.content || ''))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [file?.path]);

  // Fetch from repo
  useEffect(() => {
    if (!file?.path || file.content) return;
    
    const repoId = repo?.id;
    if (!repoId) return;

    setLoading(true);
    setError(null);
    filesApi.get(repoId, file.path)
      .then((data) => setContent(data.file?.content || ''))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [file?.path, repo?.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const githubUrl = repo?.indexedCommitSha && file?.path
    ? `${repo.githubUrl}/blob/${repo.indexedCommitSha}/${file.path}`
    : null;

  const lang = LANG_MAP[file?.language] || 'text';

  return (
    <div
      className="flex flex-col h-full rounded-xl overflow-hidden"
      style={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(17,17,24,0.8)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-slate-500 font-mono truncate">{file?.path}</span>
          {file?.language && (
            <span
              className="px-1.5 py-0.5 rounded text-xs text-slate-500 flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {file.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {content && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:text-slate-300 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-500 hover:text-indigo-400 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <ExternalLink className="w-3 h-3" />
              GitHub
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="p-6 space-y-3">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className={`h-4 ${i % 4 === 0 ? 'w-2/3' : i % 3 === 0 ? 'w-full' : 'w-5/6'}`} />
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 p-6">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        {!loading && !error && content !== null && (
          <SyntaxHighlighter
            language={lang}
            style={vscDarkPlus}
            showLineNumbers
            wrapLongLines={false}
            customStyle={{
              margin: 0,
              padding: '16px',
              background: 'transparent',
              fontSize: '13px',
              lineHeight: '1.7',
            }}
            lineNumberStyle={{ color: '#4a4a6a', userSelect: 'none' }}
          >
            {content}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
}
