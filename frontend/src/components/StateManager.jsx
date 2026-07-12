import React, { useEffect, useRef } from 'react';
import { Database, NotebookPen, RefreshCw, Lock, Send } from 'lucide-react';
import { AgentResponsePanel, parseMarkdownToHtml } from './Markdown';
import { HistoryPanel } from './HistoryPanel';

export function StateManager({
  stateInput,
  setStateInput,
  loadingState,
  submitStateUpdate,
  stateResponse,
  agentLogs,
  loadingLogs,
  expandedLogId,
  setExpandedLogId,
  todayLogCount,
  backendConnected,
  
  // Conversational session props
  stateManagerMessages,
  stateChatInput,
  setStateChatInput,
  sendStateChatMessage,
  loadingStateChat,
  lockStateSession,
  onDeleteLog
}) {
  const chatEndRef = useRef(null);
  const isSessionActive = stateManagerMessages && stateManagerMessages.length > 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [stateManagerMessages]);

  return (
    <div className="grid-3">
      {/* Left Input form */}
      <div className="glass-card" style={{ height: 'fit-content' }}>
        <div className="card-title">
          <Database size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>What happened?</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
          Tell the State Manager what happened — updates, decisions, milestones, new ideas, corrections.
          It will determine which files changed and write them directly.
        </p>
        <textarea
          className="textarea-input"
          rows={14}
          value={stateInput}
          onChange={e => setStateInput(e.target.value)}
          disabled={isSessionActive || loadingState || !backendConnected}
          placeholder="e.g. Skipped gym again today. PhonePe process confirmed for August 10. Decided to stop pursuing GSoC this season since placements are too close."
          style={{ marginBottom: '16px' }}
        />
        {isSessionActive && (
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--warning)',
            background: 'var(--warning-bg)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            A conversational session is active. Conclude the session to post a new entry.
          </div>
        )}
        <button
          className="btn btn-primary"
          onClick={submitStateUpdate}
          disabled={isSessionActive || loadingState || !stateInput.trim() || !backendConnected}
          style={{ width: '100%' }}
        >
          {loadingState ? (
            <>
              <RefreshCw size={16} className="loading-spinner" />
              <span>Updating knowledge base...</span>
            </>
          ) : (
            <span>Update State</span>
          )}
        </button>
        {todayLogCount > 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.85 }}>
            <NotebookPen size={13} />
            {todayLogCount} day logger {todayLogCount === 1 ? 'note' : 'notes'} will be included automatically.
          </p>
        )}
      </div>
      
      {/* Middle Session/Response card */}
      {!isSessionActive ? (
        <AgentResponsePanel
          response={stateResponse}
          loading={loadingState}
          emptyIcon={Database}
          emptyTitle="Waiting for updates"
          emptySubtitle="The State Manager will tell you which files it updated and why."
        />
      ) : (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content', minHeight: '480px' }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Active State Manager Session</span>
            </div>
            <button
              onClick={lockStateSession}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', minHeight: '30px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Lock Session & End Day"
            >
              <Lock size={12} />
              <span>Lock Session</span>
            </button>
          </div>

          {/* Chat message thread */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px', maxHeight: '420px', minHeight: '300px' }}>
            {stateManagerMessages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
                    : 'var(--bg-tertiary)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}>
                  {msg.role === 'assistant' ? (
                    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(msg.content) }} />
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {loadingStateChat && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 16px', borderRadius: '14px 14px 14px 2px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s infinite' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s 0.2s infinite' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', animation: 'pulse 1s 0.4s infinite' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Follow-up input bar */}
          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
            <input
              type="text"
              className="text-input"
              value={stateChatInput}
              onChange={e => setStateChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendStateChatMessage(); }}
              placeholder="Tell State Manager to update goals, projects, etc..."
              disabled={loadingStateChat || !backendConnected}
              style={{ flex: 1, minHeight: '40px' }}
            />
            <button
              className="btn btn-primary"
              onClick={sendStateChatMessage}
              disabled={!stateChatInput.trim() || loadingStateChat || !backendConnected}
              style={{ padding: '0 16px', height: '40px', flexShrink: 0 }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Right History list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Past Updates
          </div>
          <HistoryPanel
            logs={agentLogs.state_manager}
            loading={loadingLogs}
            expandedId={expandedLogId}
            onExpand={setExpandedLogId}
            agentLabel="State Manager"
            onDelete={onDeleteLog}
          />
        </div>
      </div>
    </div>
  );
}
