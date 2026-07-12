import React from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { AgentResponsePanel } from './Markdown';
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
  backendConnected
}) {
  return (
    <div className="grid-3">
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
          disabled={loadingDecision || !backendConnected}
          placeholder="e.g. Available: 6 hours. Energy: Medium. Meetings: 3–4pm team call. PhonePe process in 3 weeks."
          style={{ marginBottom: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}
        />
        <button
          className="btn btn-primary"
          onClick={submitDecision}
          disabled={loadingDecision || !decisionInput.trim() || !backendConnected}
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
      
      <AgentResponsePanel
        response={decisionResponse}
        loading={loadingDecision}
        emptyIcon={Calendar}
        emptyTitle="Waiting for constraints"
        emptySubtitle="The Decision Engine reads your source of truth and decides what to focus on — without changing anything."
      />

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
