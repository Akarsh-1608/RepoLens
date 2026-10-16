import { Link, useLocation } from 'react-router-dom';
import { Layers, Search, MessageSquare } from 'lucide-react';
import { GithubIcon } from './ui/index.jsx';

export default function Navbar() {
  const location = useLocation();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
      style={{
        background: 'rgba(10,10,15,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Link to="/" className="flex items-center gap-3 group">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
        >
          <Layers className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white text-lg tracking-tight">
          Repo<span className="gradient-text">Lens</span>
        </span>
      </Link>

      <div className="flex items-center gap-4">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <GithubIcon className="w-4 h-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>
    </nav>
  );
}
