import React from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { AgentResponsePanel } from './Markdown';
import { HistoryPanel } from './HistoryPanel';

export function ReflectionAgent({
  reflectionInput,
  setReflectionInput,
  loadingReflection,
  submitReflection,
  reflectionResponse,
  agentLogs,
  loadingLogs,
  expandedLogId,
  setExpandedLogId,
  isSunday,
  backendConnected
}) {
  return (
    <div className="grid-3">
      <div className="glass-card" style={{ height: 'fit-content' }}>
        <div className="card-title">
          <Sparkles size={18} style={{ color: 'var(--accent-secondary)' }} />
          <span>Weekly Reflection</span>
          {isSunday && (
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', background: 'rgba(168,85,247,0.15)', color: 'var(--accent-secondary)', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(168,85,247,0.3)' }}>
              It's Sunday — reflection time
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
          The Reflection Agent reads your daily logs, finds patterns, detects bottlenecks, and suggests exactly 
          one improvement and one new principle. It never plans or edits files.
        </p>
        {!isSunday && (
          <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.2)', color: 'var(--warning)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Reflection is designed for Sundays, but you can run it any time.
          </div>
        )}
        <textarea
          className="textarea-input"
          rows={4}
          value={reflectionInput}
          onChange={e => setReflectionInput(e.target.value)}
          placeholder="Optional: add context for the reflection (e.g. 'focus on gym consistency this week')"
          disabled={loadingReflection || !backendConnected}
          style={{ marginBottom: '16px' }}
        />
        <button
          className="btn btn-primary"
          onClick={submitReflection}
          disabled={loadingReflection || !backendConnected}
          style={{ width: '100%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
        >
          {loadingReflection ? (
            <>
              <RefreshCw size={16} className="loading-spinner" />
              <span>Analyzing weekly logs...</span>
            </>
          ) : (
            <span>Run Weekly Reflection</span>
          )}
        </button>
      </div>
      
      <AgentResponsePanel
        response={reflectionResponse}
        loading={loadingReflection}
        emptyIcon={Sparkles}
        emptyTitle="Ready to reflect"
        emptySubtitle="The Reflection Agent will analyze your daily logs and extract patterns, bottlenecks, one improvement, and one new principle."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Past Reflections
          </div>
          <HistoryPanel
            logs={agentLogs.reflection}
            loading={loadingLogs}
            expandedId={expandedLogId}
            onExpand={setExpandedLogId}
            agentLabel="Reflection"
          />
        </div>
      </div>
    </div>
  );
}
