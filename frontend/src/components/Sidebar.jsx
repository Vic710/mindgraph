import React from 'react';
import {
  Brain, X, RefreshCw, Camera, Cloud,
  Database, Calendar, Sparkles, NotebookPen, MessageSquare, FileText
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'state',      label: 'State Manager',   icon: Database },
  { id: 'decision',   label: 'Decision Engine',  icon: Calendar },
  { id: 'reflection', label: 'Reflection',        icon: Sparkles },
  { id: 'logger',     label: 'Day Logger',        icon: NotebookPen },
  { id: 'chat',       label: 'Chat',              icon: MessageSquare },
  { id: 'files',      label: 'File Explorer',     icon: FileText },
];

export function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
  isSunday,
  todayLogCount,
  neonAvailable,
  neonLastSynced,
  triggerSnapshot,
  loadingSnapshot,
  backendConnected,
  handleReconnect,
  checkingConnection
}) {
  return (
    <>
      {/* ---- Mobile overlay backdrop ---- */}
      {sidebarOpen && (
        <div className="mobile-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ---- Sidebar ---- */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="logo-container">
          <div className="logo-icon">
            <Brain size={18} color="white" />
          </div>
          <span className="logo-text">MindGraph</span>
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav-links">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className={`nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => { setActiveTab(id); setSidebarOpen(false); }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'reflection' && isSunday && (
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', background: 'var(--accent-secondary)', color: '#fff', padding: '2px 6px', borderRadius: '8px' }}>
                  Sunday
                </span>
              )}
              {id === 'logger' && todayLogCount > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', background: 'rgba(99,102,241,0.2)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '8px', fontWeight: 700 }}>
                  {todayLogCount}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {neonAvailable && neonLastSynced && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Cloud size={12} color="#10b981" />
              <span>Auto-Synced to Cloud</span>
            </div>
          )}
          <button
            className="btn btn-secondary"
            onClick={triggerSnapshot}
            disabled={loadingSnapshot || !backendConnected}
            style={{ width: '100%', fontSize: '0.85rem' }}
          >
            {loadingSnapshot ? <RefreshCw size={14} className="loading-spinner" /> : <Camera size={14} />}
            <span>Snapshot Brain</span>
          </button>
          <div
            className="status-badge clickable"
            onClick={handleReconnect}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between', width: '100%' }}
            title="Click to reconnect / check status"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`status-dot ${backendConnected ? '' : 'warning'}`} />
              <span>{backendConnected ? 'API Online' : 'API Offline'}</span>
            </div>
            <RefreshCw
              size={12}
              className={checkingConnection ? 'loading-spinner' : ''}
              style={{ opacity: 0.6 }}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
