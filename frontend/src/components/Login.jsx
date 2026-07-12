import React from 'react';
import { Brain, RefreshCw } from 'lucide-react';

export function Login({ loginPassword, setLoginPassword, isLoggingIn, handleLogin, notification }) {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <Brain size={32} color="var(--accent-primary)" />
        </div>
        <h1 className="login-title">MindGraph</h1>
        <p className="login-subtitle">Welcome back, Shlok. Enter password to unlock your workspace.</p>
        <form onSubmit={handleLogin} style={{ width: '100%' }}>
          <input
            type="password"
            className="text-input"
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            placeholder="Enter password..."
            disabled={isLoggingIn}
            autoFocus
            style={{ marginBottom: '16px', textAlign: 'center', letterSpacing: loginPassword ? '0.2em' : 'normal' }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoggingIn || !loginPassword.trim()}
            style={{ width: '100%', minHeight: '44px' }}
          >
            {isLoggingIn ? <RefreshCw size={16} className="loading-spinner" /> : <span>Unlock Workspace</span>}
          </button>
        </form>
        {notification && (
          <div style={{
            marginTop: '16px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
            background: notification.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
            color: notification.type === 'error' ? 'var(--danger)' : 'var(--success)',
            border: `1px solid ${notification.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
            width: '100%',
            textAlign: 'center'
          }}>
            {notification.text}
          </div>
        )}
      </div>
    </div>
  );
}
