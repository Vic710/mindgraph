import React from 'react';
import { Plus, Trash2, MessageSquare, Send } from 'lucide-react';
import { MarkdownContent } from './Markdown';

export function Chat({
  threads,
  chatThreadId,
  switchThread,
  startNewChat,
  deleteThreadEntry,
  chatMessages,
  loadingChat,
  chatEndRef,
  chatInput,
  setChatInput,
  sendChatMessage,
  backendConnected
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', height: 'calc(100vh - var(--header-height) - 64px)' }}>
      {/* Thread sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '16px', overflow: 'hidden' }}>
        <button className="btn btn-primary" onClick={startNewChat} style={{ width: '100%', marginBottom: '8px' }}>
          <Plus size={15} /><span>New Chat</span>
        </button>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '4px 4px', marginBottom: '4px' }}>
          Previous Chats
        </div>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {threads.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 4px' }}>No previous chats yet.</p>
          ) : (
            threads.map(tid => (
              <div
                key={tid}
                onClick={() => switchThread(tid)}
                className="thread-item-container"
                style={{
                  padding: '6px 8px 6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  fontSize: '0.8rem', color: tid === chatThreadId ? 'var(--text-primary)' : 'var(--text-muted)',
                  background: tid === chatThreadId ? 'rgba(99,102,241,0.1)' : 'transparent',
                  border: tid === chatThreadId ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                  {tid.slice(0, 8)}...
                </span>
                <button
                  onClick={(e) => deleteThreadEntry(tid, e)}
                  className="thread-delete-btn"
                  aria-label="Delete chat"
                  style={{
                    background: 'none', border: 'none', padding: '4px',
                    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', borderRadius: '4px', transition: 'all 0.15s'
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {chatMessages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, textAlign: 'center' }}>
              <MessageSquare size={48} style={{ strokeWidth: 1, color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h3 style={{ marginBottom: '8px' }}>New conversation</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '320px' }}>
                Your life context will be automatically shared on your first message. Just start talking.
              </p>
            </div>
          )}

          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '72%',
                padding: '12px 16px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                  : 'var(--bg-tertiary)',
                border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                wordBreak: 'break-word',
              }}>
                {msg.role === 'assistant' ? (
                  <MarkdownContent content={msg.content} className="markdown-body" />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {loadingChat && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '12px 20px', borderRadius: '18px 18px 18px 4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s infinite' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s 0.2s infinite' }} />
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s 0.4s infinite' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input bar */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '12px', alignItems: 'flex-end', background: 'var(--bg-primary)' }}>
          <textarea
            className="textarea-input"
            rows={1}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
            placeholder="Message... (Enter to send, Shift+Enter for newline)"
            disabled={loadingChat || !backendConnected}
            style={{ flex: 1, resize: 'none', minHeight: '44px', maxHeight: '140px', overflowY: 'auto' }}
          />
          <button
            className="btn btn-primary"
            onClick={sendChatMessage}
            disabled={loadingChat || !chatInput.trim() || !backendConnected}
            style={{ flexShrink: 0, height: '44px', padding: '0 16px' }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
