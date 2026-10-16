import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Zap, GitBranch, Cpu, Shield, ArrowRight, Star, GitFork } from 'lucide-react';
import toast from 'react-hot-toast';
import { repositoriesApi } from '../services/api.js';
import { Button, Spinner, GithubIcon } from '../components/ui/index.jsx';

const EXAMPLE_REPOS = [
  { url: 'https://github.com/expressjs/express', desc: 'Fast web framework for Node.js', stars: '64k' },
  { url: 'https://github.com/facebook/react', desc: 'The React library for web UIs', stars: '226k' },
  { url: 'https://github.com/sindresorhus/got', desc: 'Human-friendly HTTP request library', stars: '14k' },
  { url: 'https://github.com/fastify/fastify', desc: 'Fast and low overhead web framework', stars: '32k' },
];

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Deep Codebase Analysis',
    desc: 'Ingests actual source files, respects rate limits, and filters noise like dependencies and binaries.',
  },
  {
    icon: Cpu,
    title: 'Semantic Vector Search',
    desc: 'pgvector-powered search finds conceptually relevant code, not just keyword matches.',
  },
  {
    icon: Zap,
    title: 'AI-Powered Q&A',
    desc: 'Ask natural language questions. Get answers grounded in your actual source code with file citations.',
  },
  {
    icon: Shield,
    title: 'Production Architecture',
    desc: 'Redis + BullMQ async processing, PostgreSQL persistence, incremental re-indexing.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error('Please enter a GitHub repository URL');
      return;
    }

    setLoading(true);
    try {
      const data = await repositoriesApi.create(url.trim());
      toast.success(data.alreadyIndexing ? 'Repository found - continuing indexing' : 'Repository queued for indexing!');
      navigate(`/repositories/${data.repository.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to add repository');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f' }}>
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(167,139,250,0.06) 0%, transparent 50%)',
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pb-16 pt-24">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8 slide-up"
          style={{
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
            color: '#818cf8',
          }}
        >
          <Zap className="w-3.5 h-3.5" />
          AI-Powered Codebase Intelligence
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-center mb-6 leading-tight slide-up" style={{ animationDelay: '0.1s' }}>
          <span className="text-white">Understand any</span>
          <br />
          <span className="gradient-text">GitHub repository</span>
          <br />
          <span className="text-white">instantly</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 text-center max-w-2xl mb-12 slide-up" style={{ animationDelay: '0.2s' }}>
          Paste a GitHub URL. RepoLens indexes the source code, builds a semantic search index,
          and lets you ask questions about the codebase in plain English — with cited source locations.
        </p>

        {/* Input */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl slide-up" style={{ animationDelay: '0.3s' }}>
          <div
            className="gradient-border flex items-center gap-3 p-2 rounded-xl"
            style={{
              background: 'rgba(22,22,31,0.9)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <div className="flex items-center gap-2 px-3 text-slate-500">
              <GithubIcon className="w-5 h-5 flex-shrink-0" />
            </div>
            <input
              id="repo-url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repository"
              className="flex-1 bg-transparent text-white placeholder-slate-600 outline-none text-sm py-2"
              disabled={loading}
            />
            <Button
              type="submit"
              loading={loading}
              className="flex-shrink-0 rounded-lg"
            >
              {!loading && <ArrowRight className="w-4 h-4" />}
              Analyze
            </Button>
          </div>
        </form>

        {/* Example repos */}
        <div className="flex flex-wrap justify-center gap-2 mt-6 slide-up" style={{ animationDelay: '0.4s' }}>
          <span className="text-slate-600 text-sm self-center">Try:</span>
          {EXAMPLE_REPOS.slice(0, 3).map((r) => (
            <button
              key={r.url}
              onClick={() => setUrl(r.url)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-indigo-400 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
            >
              {r.url.replace('https://github.com/', '')}
            </button>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Built for engineers</h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Not a toy demo. A real pipeline that indexes code, generates embeddings, and retrieves grounded answers.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="p-6 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: 'rgba(22,22,31,0.7)',
                  border: '1px solid rgba(99,102,241,0.12)',
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ background: 'rgba(99,102,241,0.15)' }}
                >
                  <f.icon className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="relative px-6 pb-24">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-600 text-sm mb-6 uppercase tracking-widest">Stack</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['React + Vite', 'Node.js + Express', 'PostgreSQL + pgvector', 'Redis + BullMQ', 'OpenAI Embeddings', 'Tailwind CSS', 'Zod Validation'].map((t) => (
              <span
                key={t}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400"
                style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
