import React from 'react';
import { RefreshCw } from 'lucide-react';
import { parseMarkdownToHtml } from './Markdown';
import { parseDateSafe } from './utils';

export function HistoryPanel({ logs, loading, expandedId, onExpand, agentLabel }) {
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
      <RefreshCw size={16} className="loading-spinner" style={{ color: 'var(--text-muted)' }} />
    </div>
  );
  if (!logs || logs.length === 0) return (
    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '8px 0' }}>No past {agentLabel} responses yet.</p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {logs.map(log => {
        const isOpen = expandedId === log.id;
        const date = parseDateSafe(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return (
          <div
            key={log.id}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              background: isOpen ? 'var(--bg-primary)' : 'var(--bg-secondary)',
              transition: 'background 0.15s ease',
            }}
          >
            {/* Header row — always visible */}
            <div
              onClick={() => onExpand(isOpen ? null : log.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', cursor: 'pointer', gap: '12px',
              }}
            >
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.input.slice(0, 80)}{log.input.length > 80 ? '…' : ''}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{date}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </div>
            {/* Expanded response */}
            {isOpen && (
              <div
                style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-color)' }}
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(log.response) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
