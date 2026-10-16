import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Star, GitFork, Globe, RefreshCw, Search, MessageSquare,
  Folder, File, Code, AlertCircle, CheckCircle, Clock, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { repositoriesApi, jobsApi } from '../services/api.js';
import { StatusBadge, ProgressBar, Button, Card, Skeleton, EmptyState, Tag } from '../components/ui/index.jsx';
import FileTree from '../components/FileTree.jsx';
import SearchPanel from '../components/SearchPanel.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import CodeViewer from '../components/CodeViewer.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Code },
  { id: 'files', label: 'Files', icon: Folder },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'ask', label: 'Ask AI', icon: MessageSquare },
];

export default function RepositoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [repo, setRepo] = useState(null);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFile, setSelectedFile] = useState(null);
  const [reindexing, setReindexing] = useState(false);

  const fetchRepo = useCallback(async () => {
    try {
      const data = await repositoriesApi.get(id);
      setRepo(data.repository);
      setJob(data.job);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRepo();
  }, [fetchRepo]);

  // Poll status while indexing
  useEffect(() => {
    if (!repo || !['queued', 'processing', 'pending'].includes(repo.status)) return;

    const interval = setInterval(async () => {
      await fetchRepo();
    }, 3000);

    return () => clearInterval(interval);
  }, [repo?.status, fetchRepo]);

  const handleReindex = async () => {
    setReindexing(true);
    try {
      await repositoriesApi.reindex(id);
      toast.success('Reindexing scheduled');
      await fetchRepo();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setReindexing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 px-6">
        <div className="max-w-6xl mx-auto py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-96" />
            <div className="grid grid-cols-4 gap-4 mt-8">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !repo) {
    return (
      <div className="min-h-screen pt-20 px-6 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Repository not found</h2>
          <p className="text-slate-500 mb-6">{error || 'This repository does not exist'}</p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Button>
        </div>
      </div>
    );
  }

  const isIndexing = ['queued', 'processing', 'pending'].includes(repo.status);
  const isCompleted = repo.status === 'completed';
  const isFailed = repo.status === 'failed';

  return (
    <div className="min-h-screen pt-20" style={{ background: '#0a0a0f' }}>
      {/* Header */}
      <div
        className="border-b px-6 py-6"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(17,17,24,0.8)' }}
      >
        <div className="max-w-6xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            All repositories
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">
                  <a
                    href={repo.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    {repo.owner}/{repo.name}
                  </a>
                </h1>
                <StatusBadge status={repo.status} />
              </div>

              {repo.description && (
                <p className="text-slate-500 text-sm mb-3 max-w-2xl">{repo.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-slate-500">
                {repo.language && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    {repo.language}
                  </span>
                )}
                {repo.stars > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" />
                    {(repo.stars / 1000).toFixed(1)}k
                  </span>
                )}
                {repo.forks > 0 && (
                  <span className="flex items-center gap-1">
                    <GitFork className="w-3.5 h-3.5" />
                    {repo.forks.toLocaleString()}
                  </span>
                )}
                {repo.defaultBranch && (
                  <span className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    {repo.defaultBranch}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isCompleted && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReindex}
                  loading={reindexing}
                >
                  <RefreshCw className="w-4 h-4" />
                  Reindex
                </Button>
              )}
              <a
                href={repo.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="sm">
                  <Globe className="w-4 h-4" />
                  View on GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Indexing progress */}
      {isIndexing && (
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-6xl mx-auto">
            <div
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-indigo-300">
                    {repo.status === 'queued' ? 'Queued for indexing...' : 'Indexing repository...'}
                  </p>
                  <span className="text-xs text-indigo-400 font-mono">
                    {job?.progress || 0}%
                  </span>
                </div>
                <ProgressBar progress={job?.progress || 0} />
                {job?.total_files > 0 && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    {job.processed_files || 0} / {job.total_files} files processed
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-6xl mx-auto">
            <div
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-300 mb-1">Indexing failed</p>
                {job?.error_message && (
                  <p className="text-xs text-red-400/70">{job.error_message}</p>
                )}
              </div>
              <Button variant="danger" size="sm" onClick={handleReindex} loading={reindexing}>
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {isCompleted && (
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="max-w-6xl mx-auto flex items-center gap-6 flex-wrap">
            <Stat label="Files indexed" value={repo.fileCount?.toLocaleString() || '—'} />
            <Stat label="Branch" value={repo.defaultBranch || '—'} />
            <Stat label="Commit" value={repo.indexedCommitSha?.slice(0, 7) || '—'} mono />
            <Stat label="Indexed" value={repo.indexedAt ? new Date(repo.indexedAt).toLocaleDateString() : '—'} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="px-6 sticky top-16 z-30"
        style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="max-w-6xl mx-auto flex gap-1">
          {TABS.map((tab) => {
            const disabled = !isCompleted && ['files', 'search', 'ask'].includes(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => !disabled && setActiveTab(tab.id)}
                disabled={disabled}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'text-indigo-400 border-indigo-500'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <OverviewTab repo={repo} job={job} onTabChange={setActiveTab} />
        )}
        {activeTab === 'files' && isCompleted && (
          <div className="flex gap-6 h-[70vh]">
            <FileTree
              repoId={id}
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
              className="w-72 flex-shrink-0"
            />
            <div className="flex-1 overflow-hidden">
              {selectedFile ? (
                <CodeViewer file={selectedFile} repo={repo} />
              ) : (
                <EmptyState
                  icon={File}
                  title="Select a file"
                  description="Click a file in the tree to view its source code"
                />
              )}
            </div>
          </div>
        )}
        {activeTab === 'search' && isCompleted && (
          <SearchPanel repoId={id} repo={repo} />
        )}
        {activeTab === 'ask' && isCompleted && (
          <ChatPanel repoId={id} repo={repo} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-slate-600 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm text-slate-300 font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function OverviewTab({ repo, job, onTabChange }) {
  const isCompleted = repo.status === 'completed';

  return (
    <div className="space-y-6 fade-in">
      {/* Quick actions */}
      {isCompleted && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ActionCard
            icon={Search}
            title="Semantic Search"
            desc="Search for concepts, patterns, and implementations across the entire codebase"
            action="Search code"
            onClick={() => onTabChange('search')}
          />
          <ActionCard
            icon={MessageSquare}
            title="Ask AI Questions"
            desc="Ask natural language questions and get answers grounded in the actual source code"
            action="Start chatting"
            onClick={() => onTabChange('ask')}
          />
        </div>
      )}

      {/* Repository info */}
      <div
        className="p-6 rounded-xl"
        style={{ background: 'rgba(22,22,31,0.7)', border: '1px solid rgba(99,102,241,0.1)' }}
      >
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Repository Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <InfoItem label="Language" value={repo.language || 'Mixed'} />
          <InfoItem label="Files" value={repo.fileCount?.toLocaleString() || '—'} />
          <InfoItem label="Stars" value={repo.stars > 0 ? `${(repo.stars/1000).toFixed(1)}k` : '—'} />
          <InfoItem label="Forks" value={repo.forks > 0 ? repo.forks.toLocaleString() : '—'} />
        </div>
        {repo.indexedCommitSha && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-slate-600 mb-1">Indexed at commit</p>
            <code className="text-xs text-indigo-400 font-mono">{repo.indexedCommitSha}</code>
          </div>
        )}
      </div>

      {/* Job history */}
      {job && (
        <div
          className="p-6 rounded-xl"
          style={{ background: 'rgba(22,22,31,0.7)', border: '1px solid rgba(99,102,241,0.1)' }}
        >
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Last Indexing Job</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <InfoItem label="Status" value={job.status} />
            <InfoItem label="Progress" value={`${job.progress}%`} />
            <InfoItem label="Total files" value={job.total_files || '—'} />
            <InfoItem label="Processed" value={job.processed_files || '—'} />
          </div>
          {job.error_message && (
            <div className="mt-4 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <p className="text-xs text-red-400">{job.error_message}</p>
            </div>
          )}
        </div>
      )}

      {/* Example questions */}
      {isCompleted && (
        <div
          className="p-6 rounded-xl"
          style={{ background: 'rgba(22,22,31,0.7)', border: '1px solid rgba(99,102,241,0.1)' }}
        >
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Example questions to ask</h2>
          <div className="flex flex-col gap-2">
            {[
              'How does authentication work in this repository?',
              'Where is error handling implemented?',
              'Explain the main request lifecycle',
              'What happens when invalid input is received?',
            ].map((q) => (
              <button
                key={q}
                onClick={() => onTabChange('ask')}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-400 hover:text-white hover:border-indigo-500/30 transition-all text-left"
                style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
              >
                <MessageSquare className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionCard({ icon: Icon, title, desc, action, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group p-6 rounded-xl text-left transition-all duration-300 hover:scale-[1.01]"
      style={{
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.2)',
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors"
        style={{ background: 'rgba(99,102,241,0.15)' }}
      >
        <Icon className="w-5 h-5 text-indigo-400" />
      </div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-500 text-sm mb-4">{desc}</p>
      <span className="text-xs text-indigo-400 font-medium group-hover:underline">{action} →</span>
    </button>
  );
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-slate-300 font-medium">{value}</p>
    </div>
  );
}
