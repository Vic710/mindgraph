import React from 'react';
import { NotebookPen, Plus, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { parseDateSafe } from './utils';

export function DayLogger({
  dayLogInputRef,
  dayLogInput,
  setDayLogInput,
  addDayLogEntry,
  backendConnected,
  shiftDayLogDate,
  dayLogDate,
  isToday,
  loadingDayLogs,
  dayLogs,
  deleteDayLogEntry
}) {
  return (
    <div className="logger-panel">
      {/* Quick entry */}
      <div className="glass-card" style={{ padding: '16px 20px', marginBottom: '16px' }}>
        <div className="card-title" style={{ marginBottom: '12px' }}>
          <NotebookPen size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>Log a note</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
            Notes are auto-injected into State Manager updates
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            ref={dayLogInputRef}
            className="text-input"
            type="text"
            value={dayLogInput}
            onChange={e => setDayLogInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addDayLogEntry(); }}
            placeholder="What just happened? (Enter to save)"
            disabled={!backendConnected}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={addDayLogEntry}
            disabled={!dayLogInput.trim() || !backendConnected}
            style={{ flexShrink: 0 }}
          >
            <Plus size={16} />
            <span className="btn-label-text">Log</span>
          </button>
        </div>
      </div>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button className="btn btn-secondary" onClick={() => shiftDayLogDate(-1)} style={{ padding: '8px 12px' }}>
          <ChevronLeft size={16} />
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {isToday ? `Today — ` : ''}
            {new Date(dayLogDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => shiftDayLogDate(1)}
          disabled={isToday}
          style={{ padding: '8px 12px', opacity: isToday ? 0.4 : 1 }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Notes feed */}
      {loadingDayLogs ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <RefreshCw size={20} className="loading-spinner" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : dayLogs.length === 0 ? (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', opacity: 0.55, textAlign: 'center' }}>
          <NotebookPen size={40} style={{ strokeWidth: 1, color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3 style={{ marginBottom: '6px' }}>No notes {isToday ? 'yet today' : 'for this day'}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {isToday ? 'Log quick notes throughout the day — they\'ll be sent to State Manager automatically.' : 'Nothing was logged on this date.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {dayLogs.map(entry => {
            const dt = parseDateSafe(entry.created_at);
            const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            return (
              <div
                key={entry.id}
                className="day-log-entry"
                style={{ opacity: entry.isOptimistic ? 0.6 : 1 }}
              >
                <span className="day-log-time">{timeStr}</span>
                <span className="day-log-note">{entry.note}</span>
                {entry.isOptimistic ? (
                  <div style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
                    <RefreshCw size={12} className="loading-spinner" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ) : (
                  <button
                    className="day-log-delete"
                    onClick={() => deleteDayLogEntry(entry.id)}
                    aria-label="Delete note"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
