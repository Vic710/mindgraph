import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RefreshCw } from 'lucide-react';

// Compatibility shim — kept so any code that imports parseMarkdownToHtml
// still works without changes. Returns the raw string.
export function parseMarkdownToHtml(md) {
  if (md === null || md === undefined) return '';
  if (typeof md !== 'string') {
    try { return JSON.stringify(md); } catch (_) { return String(md); }
  }
  return md;
}

// Core renderer — uses react-markdown with GFM so that:
//  - Underscores inside words/filenames (e.g. 5_daily_log.md) are NOT treated as italics
//  - Code fences, tables, checkboxes, and strikethrough work correctly
//  - Empty paragraphs are never emitted
export function MarkdownContent({ content, className }) {
  if (!content) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={className || 'markdown-body'}
      components={{
        ul: ({ node, ...props }) => <ul className="markdown-list" {...props} />,
        ol: ({ node, ...props }) => <ol className="markdown-list-ordered" {...props} />,
        code: ({ node, inline, className: cls, children, ...props }) => (
          <code className={cls} {...props}>{children}</code>
        ),
        // Suppress genuinely empty paragraphs
        p: ({ node, children, ...props }) => {
          const text = String(children ?? '').trim();
          if (!text) return null;
          return <p {...props}>{children}</p>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function AgentResponsePanel({ response, loading, emptyIcon: Icon, emptyTitle, emptySubtitle }) {
  if (loading) {
    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center' }}>
        <RefreshCw size={40} className="loading-spinner" style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
        <h3 style={{ marginBottom: '8px' }}>Agent is thinking...</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gemini is processing your request.</p>
      </div>
    );
  }
  if (!response) {
    return (
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center', opacity: 0.6 }}>
        <Icon size={48} style={{ strokeWidth: 1, color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={{ marginBottom: '8px' }}>{emptyTitle}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{emptySubtitle}</p>
      </div>
    );
  }
  return (
    <div className="glass-card">
      <MarkdownContent content={response} className="markdown-body" />
    </div>
  );
}


