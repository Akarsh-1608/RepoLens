import { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, ExternalLink, ChevronDown, ChevronRight, Bot, User, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { askApi } from '../services/api.js';
import { Button, Spinner, EmptyState } from './ui/index.jsx';
import clsx from 'clsx';

function Citation({ citation, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden transition-all"
      style={{ border: '1px solid rgba(99,102,241,0.15)', background: 'rgba(99,102,241,0.04)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
      >
        <span
          className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
          style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
        >
          {index}
        </span>
        <span className="text-xs font-mono text-indigo-300 truncate flex-1">{citation.filePath}</span>
        <span className="text-xs text-slate-600 flex-shrink-0">L{citation.startLine}–{citation.endLine}</span>
        {citation.githubUrl && (
          <a
            href={citation.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-slate-600 hover:text-indigo-400 transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {expanded ? <ChevronDown className="w-3 h-3 text-slate-600 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
      </button>
      {expanded && citation.snippet && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <pre className="text-xs text-slate-400 p-3 overflow-x-auto" style={{ fontFamily: 'monospace', lineHeight: 1.6 }}>
            {citation.snippet}
          </pre>
        </div>
      )}
    </div>
  );
}

function Message({ message }) {
  const isUser = message.role === 'user';
  const citations = message.citations || [];

  return (
    <div className={clsx('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1"
          style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
        >
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div className={clsx('max-w-[85%] space-y-3', isUser ? 'items-end' : 'items-start')}>
        <div
          className={clsx(
            'rounded-xl px-4 py-3 text-sm',
            isUser
              ? 'text-white'
              : 'text-slate-300'
          )}
          style={isUser
            ? { background: 'linear-gradient(135deg, #4f46e5, #6366f1)' }
            : { background: 'rgba(22,22,31,0.9)', border: '1px solid rgba(255,255,255,0.08)' }
          }
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ node, inline, className, children, ...props }) {
                    return inline ? (
                      <code
                        className="px-1 py-0.5 rounded text-xs font-mono"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <pre className="p-3 rounded-lg overflow-x-auto my-2" style={{ background: '#0d0d16' }}>
                        <code className="text-xs font-mono text-slate-300" {...props}>{children}</code>
                      </pre>
                    );
                  },
                  a({ node, children, href, ...props }) {
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline" {...props}>
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Citations */}
        {citations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-600 px-1">Sources ({citations.length})</p>
            {citations.map((c, i) => (
              <Citation key={c.filePath + c.startLine} citation={c} index={c.index || i + 1} />
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1"
          style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          <User className="w-4 h-4 text-indigo-400" />
        </div>
      )}
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  'How does authentication work in this repository?',
  'Where is error handling implemented?',
  'Explain the main request lifecycle',
  'What happens when invalid input is received?',
  'Which modules communicate with each other?',
  'Where should I add a new feature?',
];

export default function ChatPanel({ repoId, repo }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (questionText) => {
    const q = questionText || question.trim();
    if (!q || loading) return;

    const userMessage = { role: 'user', content: q, id: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setLoading(true);
    setError(null);

    try {
      const data = await askApi.ask(repoId, q, sessionId);
      setSessionId(data.sessionId);

      const assistantMessage = {
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        id: data.messageId,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message);
      const errorMessage = {
        role: 'assistant',
        content: `I encountered an error: ${err.message}. Please try again.`,
        citations: [],
        id: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col fade-in" style={{ height: '75vh' }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-6 p-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(167,139,250,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              <MessageSquare className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-2">Ask about this repository</h3>
            <p className="text-slate-500 text-sm mb-8 max-w-md mx-auto">
              Answers are grounded in the actual source code with file and line number citations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-left px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-white transition-all hover:scale-[1.01]"
                  style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}
            >
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(22,22,31,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Spinner size="sm" />
              <span className="text-sm text-slate-500">Searching code and generating answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 p-4 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(10,10,15,0.8)' }}
      >
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setSessionId(null); }}
            className="text-xs text-slate-600 hover:text-slate-400 mb-3 transition-colors"
          >
            Clear conversation
          </button>
        )}
        <div
          className="flex items-end gap-3 p-3 rounded-xl"
          style={{ background: 'rgba(22,22,31,0.9)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <textarea
            ref={inputRef}
            id="chat-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about this codebase... (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-white placeholder-slate-700 outline-none text-sm resize-none"
            style={{ maxHeight: '120px', lineHeight: '1.6' }}
            disabled={loading}
          />
          <Button
            onClick={() => handleSend()}
            loading={loading}
            disabled={!question.trim() || loading}
            size="sm"
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-slate-700 mt-2 text-center">
          Answers are grounded in indexed source code. Verify important details.
        </p>
      </div>
    </div>
  );
}
