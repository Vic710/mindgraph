import React, { useEffect, useRef } from 'react';
import { Calendar, RefreshCw, Lock, Send } from 'lucide-react';
import { AgentResponsePanel, parseMarkdownToHtml } from './Markdown';
import { HistoryPanel } from './HistoryPanel';

export function DecisionEngine({
  decisionInput,
  setDecisionInput,
  loadingDecision,
  submitDecision,
  decisionResponse,
  agentLogs,
  loadingLogs,
  expandedLogId,
  setExpandedLogId,
  backendConnected,
  
  // Conversational session props
  decisionEngineMessages,
  decisionChatInput,
  setDecisionChatInput,
  sendDecisionChatMessage,
  loadingDecisionChat,
  lockDecisionSession
}) {
  const chatEndRef = useRef(null);
  const isSessionActive = decisionEngineMessages && decisionEngineMessages.length > 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decisionEngineMessages]);

  return (
    <div className="grid-3">
      {/* Left Input form */}
      <div className="glass-card" style={{ height: 'fit-content' }}>
        <div className="card-title">
          <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>What are today's constraints?</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
          Tell the Decision Engine what you have available today — time, energy, meetings.
          It reads your goals, current state, decisions, and principles to decide what you should work on.
        </p>
        <textarea
          className="textarea-input"
          rows={10}
          value={decisionInput}
          onChange={e => setDecisionInput(e.target.value)}
          disabled={isSessionActive || loadingDecision || !backendConnected}
          placeholder="e.g. Available: 6 hours. Energy: Medium. Meetings: 3–4pm team call. PhonePe process in 3 weeks."
          style={{ marginBottom: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}
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
            A conversational session is active. Conclude the session to generate a new plan.
          </div>
        )}
        <button
          className="btn btn-primary"
          onClick={submitDecision}
          disabled={isSessionActive || loadingDecision || !decisionInput.trim() || !backendConnected}
          style={{ width: '100%' }}
        >
          {loadingDecision ? (
            <>
              <RefreshCw size={16} className="loading-spinner" />
              <span>Deciding...</span>
            </>
          ) : (
            <span>Generate Plan</span>
          )}
        </button>
      </div>
      
      {/* Middle Session/Response card */}
      {!isSessionActive ? (
        <AgentResponsePanel
          response={decisionResponse}
          loading={loadingDecision}
          emptyIcon={Calendar}
          emptyTitle="Waiting for constraints"
          emptySubtitle="The Decision Engine reads your source of truth and decides what to focus on — without changing anything."
        />
      ) : (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content', minHeight: '480px' }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
              <span>Active Decision Engine Session</span>
            </div>
            <button
              onClick={lockDecisionSession}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', minHeight: '30px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Lock Plan & Conclude"
            >
              <Lock size={12} />
              <span>Lock Session</span>
            </button>
          </div>

          {/* Chat message thread */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto', paddingRight: '4px', marginBottom: '16px', maxHeight: '420px', minHeight: '300px' }}>
            {decisionEngineMessages.map((msg, idx) => (
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
            {loadingDecisionChat && (
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
              value={decisionChatInput}
              onChange={e => setDecisionChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendDecisionChatMessage(); }}
              placeholder="Refine constraints or ask questions about priorities..."
              disabled={loadingDecisionChat || !backendConnected}
              style={{ flex: 1, minHeight: '40px' }}
            />
            <button
              className="btn btn-primary"
              onClick={sendDecisionChatMessage}
              disabled={!decisionChatInput.trim() || loadingDecisionChat || !backendConnected}
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
            Past Plans
          </div>
          <HistoryPanel
            logs={agentLogs.decision_engine}
            loading={loadingLogs}
            expandedId={expandedLogId}
            onExpand={setExpandedLogId}
            agentLabel="Decision Engine"
          />
        </div>
      </div>
    </div>
  );
}
