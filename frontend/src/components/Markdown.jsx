import React from 'react';
import { RefreshCw } from 'lucide-react';

// Lightweight markdown → HTML renderer (no external deps)
export function parseMarkdownToHtml(md) {
  if (md === null || md === undefined) return '';
  if (typeof md !== 'string') {
    try {
      md = JSON.stringify(md);
    } catch (_) {
      md = String(md);
    }
  }

  // Escape HTML entities to prevent injection
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers (H1-H6)
  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');

  // Inline Code
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');

  // Blockquotes
  html = html.replace(/^&gt;\s+(.*)$/gm, '<blockquote>$1</blockquote>');

  // Inline asterisks used as sub-bullets (e.g. "Text * Bullet * Bullet")
  html = html.replace(/[ \t]+\*[ \t]+/g, '<br/>• ');

  // Task lists
  html = html.replace(/^- \[x\] (.*)$/gm, '<li class="task-item checked"><input type="checkbox" checked disabled /> <span>$1</span></li>');
  html = html.replace(/^- \[ \] (.*)$/gm, '<li class="task-item"><input type="checkbox" disabled /> <span>$1</span></li>');

  // Unordered lists (- or *) at start of line
  html = html.replace(/^[-*]\s+(.*)$/gm, '<li class="unordered-item">$1</li>');

  // Ordered lists (1. 2. etc) at start of line
  html = html.replace(/^(\d+\.\s+.*)$/gm, '<li class="ordered-item">$1</li>');

  // Process line breaks and paragraphs
  const lines = html.split('\n');
  let result = [];
  let listType = null; // null | 'ul' | 'ol'
  let inBlockquote = false;

  for (let line of lines) {
    const trimmed = line.trim();

    const isOrderedItem = trimmed.startsWith('<li class="ordered-item">');
    const isUnorderedItem = trimmed.startsWith('<li class="unordered-item">') || trimmed.startsWith('<li class="task-item">') || trimmed.startsWith('<li class="task-item checked">');

    if (isOrderedItem || isUnorderedItem) {
      const targetType = isOrderedItem ? 'ol' : 'ul';
      if (listType && listType !== targetType) {
        result.push(listType === 'ol' ? '</ol>' : '</ul>');
        listType = null;
      }
      if (!listType) {
        listType = targetType;
        result.push(targetType === 'ol' ? '<ol class="markdown-list-ordered">' : '<ul class="markdown-list">');
      }
      let cleanLine = line;
      if (isOrderedItem) {
        cleanLine = line.replace('<li class="ordered-item">', '<li>');
      } else if (isUnorderedItem && line.includes('class="unordered-item"')) {
        cleanLine = line.replace('<li class="unordered-item">', '<li>');
      }
      result.push(cleanLine);
      continue;
    } else if (listType) {
      result.push(listType === 'ol' ? '</ol>' : '</ul>');
      listType = null;
    }

    if (trimmed.startsWith('<blockquote>')) {
      if (!inBlockquote) {
        inBlockquote = true;
      }
      result.push(line);
      continue;
    } else if (inBlockquote) {
      inBlockquote = false;
    }

    if (trimmed === '') {
      continue;
    }

    if (trimmed.startsWith('<h') || trimmed.startsWith('<hr') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<ul') || trimmed.startsWith('</ul') || trimmed.startsWith('<ol') || trimmed.startsWith('</ol')) {
      result.push(line);
    } else {
      result.push(`<p>${line}</p>`);
    }
  }

  if (listType) {
    result.push(listType === 'ol' ? '</ol>' : '</ul>');
  }

  return result.join('\n');
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
      <div
        className="markdown-body"
        style={{ minHeight: 0, maxHeight: 'none', border: 'none', padding: 0, background: 'transparent' }}
        dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(response) }}
      />
    </div>
  );
}
