import React from 'react';
import { Database, NotebookPen, RefreshCw } from 'lucide-react';
import { AgentResponsePanel } from './Markdown';
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
  backendConnected
}) {
  return (
    <div className="grid-3">
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
          disabled={loadingState || !backendConnected}
          placeholder="e.g. Skipped gym again today. PhonePe process confirmed for August 10. Decided to stop pursuing GSoC this season since placements are too close."
          style={{ marginBottom: '16px' }}
        />
        <button
          className="btn btn-primary"
          onClick={submitStateUpdate}
          disabled={loadingState || !stateInput.trim() || !backendConnected}
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
      
      <AgentResponsePanel
        response={stateResponse}
        loading={loadingState}
        emptyIcon={Database}
        emptyTitle="Waiting for updates"
        emptySubtitle="The State Manager will tell you which files it updated and why."
      />

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
          />
        </div>
      </div>
    </div>
  );
}
