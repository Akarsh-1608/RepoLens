import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Search, X } from 'lucide-react';
import { filesApi } from '../services/api.js';
import { Skeleton } from './ui/index.jsx';
import clsx from 'clsx';

const LANG_COLORS = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3776ab',
  Ruby: '#cc342d', Java: '#ed8b00', Go: '#00acd7', Rust: '#ce422b',
  'C++': '#00599c', C: '#555555', 'C#': '#239120', PHP: '#8892bf',
  Swift: '#fa7343', Kotlin: '#7f52ff', HTML: '#e34f26', CSS: '#1572b6',
  SQL: '#e38c00', Markdown: '#083fa1', JSON: '#616161', YAML: '#cb171e',
  Shell: '#89e051', Dockerfile: '#2496ed',
};

function getColor(language) {
  return LANG_COLORS[language] || '#6366f1';
}

function buildTree(files) {
  const root = { children: {} };
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.children[parts[i]]) {
        node.children[parts[i]] = { name: parts[i], isDir: true, children: {}, path: parts.slice(0, i + 1).join('/') };
      }
      node = node.children[parts[i]];
    }
    const filename = parts[parts.length - 1];
    node.children[filename] = {
      name: filename,
      isDir: false,
      path: file.path,
      language: file.language,
      size: file.size_bytes,
    };
  }
  return root;
}

function sortNodes(nodes) {
  return Object.values(nodes).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function TreeNode({ node, depth, onFileSelect, selectedFile, expandedDirs, toggleDir }) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedFile?.path === node.path;
  const children = node.children ? sortNodes(node.children) : [];

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => toggleDir(node.path)}
          className={clsx(
            'w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm hover:bg-white/5 transition-colors text-left',
            'text-slate-400 hover:text-slate-200'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen className="w-3.5 h-3.5 text-yellow-500/70 flex-shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-yellow-500/70 flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && (
          <div>
            {children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                onFileSelect={onFileSelect}
                selectedFile={selectedFile}
                expandedDirs={expandedDirs}
                toggleDir={toggleDir}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onFileSelect(node)}
      className={clsx(
        'w-full flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors text-left',
        isSelected
          ? 'bg-indigo-600/20 text-indigo-300'
          : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
      )}
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <File className="w-3 h-3 flex-shrink-0" />
      <span className="truncate flex-1">{node.name}</span>
      {node.language && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: getColor(node.language) }}
        />
      )}
    </button>
  );
}

export default function FileTree({ repoId, onFileSelect, selectedFile, className }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedDirs, setExpandedDirs] = useState(new Set());

  useEffect(() => {
    async function load() {
      try {
        const data = await filesApi.list(repoId, { limit: 500, offset: 0 });
        setFiles(data.files || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [repoId]);

  const tree = useMemo(() => buildTree(files), [files]);

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return [];
    return files.filter((f) => f.path.toLowerCase().includes(search.toLowerCase())).slice(0, 20);
  }, [files, search]);

  const toggleDir = (path) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  if (loading) {
    return (
      <div className={clsx('flex flex-col gap-2 p-4', className)}>
        {[...Array(8)].map((_, i) => <Skeleton key={i} className={`h-5 ${i % 3 === 0 ? 'w-3/4' : 'w-full'}`} />)}
      </div>
    );
  }

  return (
    <div
      className={clsx('flex flex-col overflow-hidden rounded-xl', className)}
      style={{ background: 'rgba(17,17,24,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Search */}
      <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-transparent text-sm text-slate-300 placeholder-slate-700 pl-8 pr-8 py-1.5 outline-none rounded"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-600" />
            </button>
          )}
        </div>
      </div>

      {/* File count */}
      <div className="px-3 py-2 text-xs text-slate-600 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {files.length} files
      </div>

      {/* Tree or search results */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {search ? (
          filteredFiles.length > 0 ? (
            filteredFiles.map((f) => (
              <button
                key={f.path}
                onClick={() => onFileSelect(f)}
                className={clsx(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors',
                  selectedFile?.path === f.path
                    ? 'bg-indigo-600/20 text-indigo-300'
                    : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
                )}
              >
                <File className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{f.path}</span>
              </button>
            ))
          ) : (
            <p className="text-center text-slate-600 text-xs py-4">No files match "{search}"</p>
          )
        ) : (
          sortNodes(tree.children).map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
            />
          ))
        )}
      </div>
    </div>
  );
}
