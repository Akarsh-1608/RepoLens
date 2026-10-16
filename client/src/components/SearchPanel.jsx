import { useState } from 'react';
import { Search, Filter, ExternalLink, ChevronDown, ChevronRight, Zap, Type } from 'lucide-react';
import { searchApi } from '../services/api.js';
import { Button, EmptyState, Spinner, Tag } from './ui/index.jsx';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import clsx from 'clsx';

const LANG_MAP = {
  JavaScript: 'javascript', TypeScript: 'typescript', Python: 'python',
  Ruby: 'ruby', Java: 'java', Go: 'go', Rust: 'rust', 'C++': 'cpp',
  CSS: 'css', HTML: 'html', SQL: 'sql', JSON: 'json', YAML: 'yaml', Shell: 'bash',
};

function ResultCard({ result, repo, index }) {
  const [expanded, setExpanded] = useState(true);
  
  const githubUrl = result.githubUrl || (
    repo?.indexedCommitSha && result.filePath
      ? `${repo.githubUrl}/blob/${repo.indexedCommitSha}/${result.filePath}#L${result.startLine}-L${result.endLine}`
      : null
  );

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{ border: '1px solid rgba(99,102,241,0.15)', background: 'rgba(17,17,24,0.7)' }}
    >
      {/* File header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-mono text-slate-600 w-6 text-right flex-shrink-0">{index + 1}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-indigo-300 font-mono truncate">{result.filePath}</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Lines {result.startLine}–{result.endLine}
              {result.language && ` · ${result.language}`}
              {result.score && ` · ${(result.score * 100).toFixed(0)}% match`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Tag className="hidden sm:flex">{result.source === 'vector' ? '⚡ Semantic' : '🔍 Keyword'}</Tag>
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-slate-600 hover:text-indigo-400 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-600" />
          )}
        </div>
      </button>

      {/* Code */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <SyntaxHighlighter
            language={LANG_MAP[result.language] || 'text'}
            style={vscDarkPlus}
            showLineNumbers
            startingLineNumber={result.startLine}
            wrapLongLines={false}
            customStyle={{
              margin: 0,
              padding: '12px 16px',
              background: 'transparent',
              fontSize: '12.5px',
              lineHeight: '1.7',
              maxHeight: '400px',
              overflow: 'auto',
            }}
            lineNumberStyle={{ color: '#4a4a6a', userSelect: 'none' }}
          >
            {result.content}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  );
}

export default function SearchPanel({ repoId, repo }) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('hybrid');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;

    setLoading(true);
    setError(null);
    try {
      const data = await searchApi.search(repoId, query.trim(), mode, 15);
      setResults(data.results);
      setLatency(data.latencyMs);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      {/* Search input */}
      <form onSubmit={handleSearch} className="mb-6">
        <div
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: 'rgba(22,22,31,0.9)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <Search className="w-5 h-5 text-slate-600 flex-shrink-0" />
          <input
            id="search-query-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search for concepts... "authentication middleware", "error handling"'
            className="flex-1 bg-transparent text-white placeholder-slate-700 outline-none text-sm"
          />
          <div className="flex items-center gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="text-xs text-slate-400 bg-transparent border-none outline-none cursor-pointer"
              style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', background: 'rgba(255,255,255,0.05)' }}
            >
              <option value="hybrid">Hybrid</option>
              <option value="vector">Semantic</option>
              <option value="keyword">Keyword</option>
            </select>
            <Button type="submit" loading={loading} size="sm">
              Search
            </Button>
          </div>
        </div>
      </form>

      {/* Results info */}
      {results !== null && (
        <div className="flex items-center gap-3 mb-4">
          <p className="text-sm text-slate-500">
            {results.length === 0
              ? 'No results found'
              : `${results.length} result${results.length !== 1 ? 's' : ''}`}
            {latency && <span className="text-slate-700"> · {latency}ms</span>}
          </p>
          {results.length > 0 && (
            <div className="flex gap-2">
              {['hybrid', 'vector', 'keyword'].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); }}
                  className={clsx(
                    'px-2 py-1 rounded text-xs transition-colors',
                    mode === m
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : 'text-slate-600 hover:text-slate-400'
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-4"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <Spinner size="lg" className="mx-auto mb-4" />
            <p className="text-slate-500 text-sm">Searching codebase...</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && results !== null && (
        results.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No results found"
            description={`No code chunks matched "${query}". Try different search terms or switch to keyword search mode.`}
          />
        ) : (
          <div className="space-y-3">
            {results.map((result, i) => (
              <ResultCard key={result.chunkId} result={result} repo={repo} index={i} />
            ))}
          </div>
        )
      )}

      {/* Empty state before search */}
      {results === null && !loading && (
        <div className="text-center py-16">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <Search className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200 mb-2">Search the codebase</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Use natural language to find relevant code. Vector search understands concepts,
            not just keywords.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {[
              'authentication middleware',
              'database connection pool',
              'error handling',
              'rate limiting',
              'request validation',
            ].map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-indigo-400 transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
