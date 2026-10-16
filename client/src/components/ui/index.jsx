import clsx from 'clsx';

export function Spinner({ size = 'md', className }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
    xl: 'w-16 h-16 border-4',
  };
  return (
    <div
      className={clsx(
        'rounded-full border-transparent border-t-indigo-500 animate-spin',
        sizes[size],
        className
      )}
      style={{ borderTopColor: '#6366f1', border: `${size === 'xl' ? 4 : 2}px solid rgba(99,102,241,0.2)`, borderTopColor: '#6366f1' }}
    />
  );
}

export function StatusBadge({ status }) {
  const variants = {
    pending: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Pending' },
    queued: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Queued' },
    processing: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'Indexing' },
    completed: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Indexed' },
    failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Failed' },
  };
  const v = variants[status] || variants.pending;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: v.color, background: v.bg }}
    >
      {status === 'processing' && (
        <span
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{ background: v.color, animation: 'pulse 1s ease-in-out infinite' }}
        />
      )}
      {status !== 'processing' && (
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: v.color }} />
      )}
      {v.label}
    </span>
  );
}

export function ProgressBar({ progress, className }) {
  return (
    <div className={clsx('w-full h-1.5 rounded-full overflow-hidden', className)} style={{ background: 'rgba(99,102,241,0.15)' }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(0, Math.min(100, progress))}%`,
          background: 'linear-gradient(90deg, #6366f1, #818cf8)',
        }}
      />
    </div>
  );
}

export function Button({ children, variant = 'primary', size = 'md', className, disabled, loading, ...props }) {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent',
    secondary: 'bg-transparent hover:bg-white/5 text-slate-300 hover:text-white border-white/10',
    ghost: 'bg-transparent hover:bg-white/5 text-slate-400 hover:text-white border-transparent',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/30',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

export function Card({ children, className, ...props }) {
  return (
    <div
      className={clsx('glass-card p-6', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={clsx('skeleton h-4', className)} />;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <Icon className="w-8 h-8 text-indigo-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
      {description && <p className="text-slate-500 text-sm mb-6 max-w-md">{description}</p>}
      {action}
    </div>
  );
}

export function Tag({ children, className }) {
  return (
    <span
      className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', className)}
      style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
    >
      {children}
    </span>
  );
}

export function GithubIcon({ className = 'w-5 h-5', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}
