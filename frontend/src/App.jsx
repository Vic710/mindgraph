import React, { useState, useEffect, useRef } from 'react';
import {
  Brain, Calendar, FileText, Save, RefreshCw,
  CheckCircle, AlertTriangle, Camera, Clock,
  Eye, Code, Sparkles, Database, MessageSquare, Plus, Trash2, Send,
  NotebookPen, ChevronLeft, ChevronRight, Menu, X, CloudUpload, Cloud
} from 'lucide-react';
import { apiService } from './services/api';

// ------------------------------------------------------------------ //
// Lightweight markdown → HTML renderer (no external deps)
// ------------------------------------------------------------------ //
function parseMarkdownToHtml(md) {
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
  // Replace space-asterisk-space with a line break and bullet symbol
  html = html.replace(/[ \t]+\*[ \t]+/g, '<br/>• ');

  // Task lists
  html = html.replace(/^- \[x\] (.*)$/gm, '<li class="task-item checked"><input type="checkbox" checked disabled /> <span>$1</span></li>');
  html = html.replace(/^- \[ \] (.*)$/gm, '<li class="task-item"><input type="checkbox" disabled /> <span>$1</span></li>');

  // Unordered lists (- or *) at start of line
  html = html.replace(/^[-*]\s+(.*)$/gm, '<li class="unordered-item">$1</li>');

  // Ordered lists (1. 2. etc) at start of line - wrap the text but preserve the item
  html = html.replace(/^(\d+\.\s+.*)$/gm, '<li class="ordered-item">$1</li>');

  // Process line breaks and paragraphs
  const lines = html.split('\n');
  let result = [];
  let listType = null; // null | 'ul' | 'ol'
  let inBlockquote = false;

  for (let line of lines) {
    const trimmed = line.trim();

    // Handle list blocks wrapping
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
      // Strip outer wrappers of ordered-item / unordered-item classes so standard li renders nicely
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

    // Handle blockquote blocks wrapping
    if (trimmed.startsWith('<blockquote>')) {
      if (!inBlockquote) {
        inBlockquote = true;
      }
      result.push(line);
      continue;
    } else if (inBlockquote) {
      inBlockquote = false;
    }

    // Skip empty lines or wrap regular lines in paragraphs
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

// ------------------------------------------------------------------ //
// Sub-components
// ------------------------------------------------------------------ //
function AgentResponsePanel({ response, loading, emptyIcon: Icon, emptyTitle, emptySubtitle }) {
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

// ------------------------------------------------------------------ //
// History Panel — shows past agent responses for a given agent type
// ------------------------------------------------------------------ //
function HistoryPanel({ logs, loading, expandedId, onExpand, agentLabel }) {
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
      <RefreshCw size={16} className="loading-spinner" style={{ color: 'var(--text-muted)' }} />
    </div>
  );
  if (!logs || logs.length === 0) return (
    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '8px 0' }}>No past {agentLabel} responses yet.</p>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {logs.map(log => {
        const isOpen = expandedId === log.id;
        const date = new Date(log.created_at + 'Z').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        return (
          <div
            key={log.id}
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              background: isOpen ? 'var(--bg-primary)' : 'var(--bg-secondary)',
              transition: 'background 0.15s ease',
            }}
          >
            {/* Header row — always visible */}
            <div
              onClick={() => onExpand(isOpen ? null : log.id)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', cursor: 'pointer', gap: '12px',
              }}
            >
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.input.slice(0, 80)}{log.input.length > 80 ? '…' : ''}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{date}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </div>
            {/* Expanded response */}
            {isOpen && (
              <div
                style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border-color)' }}
                className="markdown-body"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(log.response) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ //
// Timezone and Date helpers
// ------------------------------------------------------------------ //
const getLocalDateString = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const getLocalISOString = (date = new Date()) => {
  const offset = date.getTimezoneOffset();
  const offsetSign = offset > 0 ? '-' : '+';
  const absOffset = Math.abs(offset);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMinutes = String(absOffset % 60).padStart(2, '0');
  
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  const iso = localDate.toISOString();
  return iso.substring(0, iso.length - 1) + `${offsetSign}${offsetHours}:${offsetMinutes}`;
};

const parseDateSafe = (dateStr) => {
  if (!dateStr) return new Date();
  if (dateStr.endsWith('Z') || dateStr.includes('+') || (dateStr.includes('-') && dateStr.lastIndexOf('-') > 7)) {
    return new Date(dateStr);
  }
  return new Date(dateStr + 'Z');
};

// ------------------------------------------------------------------ //
// Main App
// ------------------------------------------------------------------ //
export default function App() {
  const [activeTab, setActiveTab] = useState('state');
  const [backendConnected, setBackendConnected] = useState(true);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('mg_auth_token'));
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Files
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [originalFileContent, setOriginalFileContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  // Agent shared state
  const [stateInput, setStateInput] = useState('');
  const [stateResponse, setStateResponse] = useState('');
  const [loadingState, setLoadingState] = useState(false);

  const [decisionInput, setDecisionInput] = useState('');
  const [decisionResponse, setDecisionResponse] = useState('');
  const [loadingDecision, setLoadingDecision] = useState(false);

  const [reflectionResponse, setReflectionResponse] = useState('');
  const [reflectionInput, setReflectionInput] = useState('');
  const [loadingReflection, setLoadingReflection] = useState(false);

  // Agent log history
  const [agentLogs, setAgentLogs] = useState({ state_manager: [], decision_engine: [], reflection: [] });
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Chat state
  const [chatThreadId, setChatThreadId] = useState(() => crypto.randomUUID());
  const [chatMessages, setChatMessages] = useState([]);  // [{ role, content }]
  const [chatInput, setChatInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [threads, setThreads] = useState([]);
  const chatEndRef = useRef(null);

  // Day Logger state
  const [dayLogs, setDayLogs] = useState([]);
  const [dayLogInput, setDayLogInput] = useState('');
  const [loadingDayLogs, setLoadingDayLogs] = useState(false);
  const [dayLogDate, setDayLogDate] = useState(() => getLocalDateString());
  const [todayLogCount, setTodayLogCount] = useState(0);
  const dayLogInputRef = useRef(null);

  // Neon sync state
  const [neonAvailable, setNeonAvailable] = useState(false);
  const [neonLastSynced, setNeonLastSynced] = useState(null);

  const isSunday = new Date().getDay() === 0;

  const notify = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- Reconnect helper ---
  const handleReconnect = async () => {
    if (checkingConnection) return;
    setCheckingConnection(true);
    try {
      const statusRes = await apiService.getNeonStatus();
      setBackendConnected(true);
      setNeonAvailable(statusRes.available);
      if (statusRes.last_synced_at) setNeonLastSynced(statusRes.last_synced_at);
      
      await fetchFiles(true);
      await fetchTodayLogCount();
      await fetchThreads();
      
      if (['state', 'decision', 'reflection'].includes(activeTab)) {
        fetchLogs(activeTab);
      } else if (activeTab === 'logger') {
        fetchDayLogs(dayLogDate);
      }
      notify('API connected successfully!');
    } catch (e) {
      setBackendConnected(false);
      notify('Cannot reach backend API.', 'error');
    } finally {
      setCheckingConnection(false);
    }
  };

  // --- File helpers ---
  const fetchFiles = async (silent = false) => {
    if (!silent) setLoadingFiles(true);
    try {
      const data = await apiService.getFiles();
      setFiles(data);
      setBackendConnected(true);
      if (data.length > 0 && !selectedFile) loadFile(data[0].name);
    } catch {
      setBackendConnected(false);
      if (!silent) notify('Cannot reach backend API.', 'error');
    } finally {
      if (!silent) setLoadingFiles(false);
    }
  };

  const loadFile = async (name) => {
    try {
      const data = await apiService.getFile(name);
      setSelectedFile(name);
      setFileContent(data.content);
      setOriginalFileContent(data.content);
      setIsEditing(false);
    } catch {
      notify(`Failed to load ${name}`, 'error');
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    try {
      await apiService.updateFile(selectedFile, fileContent);
      setOriginalFileContent(fileContent);
      notify(`Saved ${selectedFile}`);
      fetchFiles(true);
      fetchNeonStatus(); // Refresh sync timestamp
    } catch {
      notify(`Failed to save ${selectedFile}`, 'error');
    }
  };

  const triggerSnapshot = async () => {
    setLoadingSnapshot(true);
    try {
      const res = await apiService.createSnapshot();
      notify(`Snapshot created: ${res.directory}`);
    } catch {
      notify('Failed to create snapshot.', 'error');
    } finally {
      setLoadingSnapshot(false);
    }
  };

  // --- Agent calls ---
  const submitStateUpdate = async () => {
    if (!stateInput.trim()) return;
    setLoadingState(true);
    setStateResponse('');
    try {
      const res = await apiService.stateUpdate(stateInput, getLocalDateString());
      setStateResponse(res.response);
      setStateInput('');
      notify('State updated successfully.');
      fetchFiles(true);
      fetchTodayLogCount();
      fetchLogs('state', true);
      fetchNeonStatus(); // Refresh sync timestamp
    } catch (err) {
      notify(err.message || 'State Manager error.', 'error');
    } finally {
      setLoadingState(false);
    }
  };

  const submitDecision = async () => {
    if (!decisionInput.trim()) return;
    setLoadingDecision(true);
    setDecisionResponse('');
    try {
      const res = await apiService.decisionGenerate(decisionInput);
      setDecisionResponse(res.response);
      notify('Decision Engine generated your plan.');
      fetchLogs('decision');
      fetchNeonStatus(); // Refresh sync timestamp
    } catch (e) {
      notify(e.message || 'Decision Engine error.', 'error');
    } finally {
      setLoadingDecision(false);
    }
  };

  const submitReflection = async () => {
    setLoadingReflection(true);
    setReflectionResponse('');
    try {
      const res = await apiService.reflectionGenerate(reflectionInput);
      setReflectionResponse(res.response);
      notify('Reflection complete.');
      fetchLogs('reflection');
      fetchNeonStatus(); // Refresh sync timestamp
    } catch (e) {
      notify(e.message || 'Reflection Agent error.', 'error');
    } finally {
      setLoadingReflection(false);
    }
  };

  // --- Chat ---
  const fetchThreads = async () => {
    try {
      const res = await apiService.listThreads();
      setThreads(res.threads || []);
    } catch (_) {}
  };

  const startNewChat = () => {
    setChatThreadId(crypto.randomUUID());
    setChatMessages([]);
    fetchThreads();
  };

  const switchThread = async (tid) => {
    setChatThreadId(tid);
    setLoadingChat(true);
    try {
      const res = await apiService.getChatHistory(tid);
      setChatMessages(res.messages || []);
    } catch (_) {
      setChatMessages([{ role: 'assistant', content: 'Failed to load conversation history.' }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const deleteThreadEntry = (tid, e) => {
    if (e) e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: 'Delete Chat History',
      message: 'Are you sure you want to permanently delete this conversation thread? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await apiService.deleteThread(tid);
          notify('Conversation deleted.');
          if (tid === chatThreadId) {
            startNewChat();
          } else {
            fetchThreads();
          }
        } catch (_) {
          notify('Failed to delete conversation.', 'error');
        }
      }
    });
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || loadingChat) return;
    const userMsg = { role: 'user', content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setLoadingChat(true);
    try {
      const res = await apiService.chat(chatThreadId, text);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
      fetchThreads();
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Auto-scroll chat to bottom
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // --- Agent Logs ---
  const fetchLogs = async (agentKey) => {
    setLoadingLogs(true);
    try {
      const agentMap = { state: 'state_manager', decision: 'decision_engine', reflection: 'reflection' };
      const key = agentMap[agentKey];
      if (!key) return;
      const res = await apiService.getLogs(key);
      setAgentLogs(prev => ({ ...prev, [key]: res.logs || [] }));
    } catch (_) {}
    finally { setLoadingLogs(false); }
  };

  // Fetch relevant logs when switching to an agent tab
  useEffect(() => {
    if (['state', 'decision', 'reflection'].includes(activeTab)) {
      fetchLogs(activeTab);
    }
    if (activeTab === 'logger') {
      fetchDayLogs(dayLogDate);
    }
  }, [activeTab]);

  // --- Day Logger ---
  const fetchDayLogs = async (date) => {
    setLoadingDayLogs(true);
    try {
      const res = await apiService.getDayLogs(date);
      setDayLogs(res.logs || []);
    } catch (_) {}
    finally { setLoadingDayLogs(false); }
  };

  const fetchTodayLogCount = async () => {
    try {
      const today = getLocalDateString();
      const res = await apiService.getDayLogs(today);
      setTodayLogCount((res.logs || []).length);
    } catch (_) {}
  };

  const addDayLogEntry = async () => {
    const note = dayLogInput.trim();
    if (!note) return;
    
    // Clear input instantly so user is free to continue typing
    setDayLogInput('');
    dayLogInputRef.current?.focus();

    // Create an optimistic entry
    const tempId = `temp-${Date.now()}`;
    const optimisticEntry = {
      id: tempId,
      note: note,
      created_at: getLocalISOString(),
      isOptimistic: true
    };

    // Prepend locally immediately
    setDayLogs(prev => [optimisticEntry, ...prev]);
    setTodayLogCount(prev => prev + 1);

    try {
      const realEntry = await apiService.addDayLog(note, getLocalISOString());
      
      // Replace optimistic entry with the server's database entry
      setDayLogs(prev => prev.map(item => item.id === tempId ? realEntry : item));
      
      // Update count & status quietly in background
      fetchTodayLogCount();
      fetchNeonStatus();
    } catch (e) {
      // Remove optimistic entry if API write fails and restore count
      setDayLogs(prev => prev.filter(item => item.id !== tempId));
      setTodayLogCount(prev => Math.max(0, prev - 1));
      notify(e.message || 'Failed to save note to cloud.', 'error');
    }
  };

  const deleteDayLogEntry = async (id) => {
    // Keep reference of current logs in case we need to rollback
    const originalLogs = [...dayLogs];
    
    // Remove locally immediately
    setDayLogs(prev => prev.filter(l => l.id !== id));
    setTodayLogCount(prev => Math.max(0, prev - 1));

    try {
      await apiService.deleteDayLog(id);
      fetchNeonStatus();
    } catch (e) {
      // Rollback to original logs on failure
      setDayLogs(originalLogs);
      const today = getLocalDateString();
      if (dayLogDate === today) fetchTodayLogCount();
      notify('Failed to delete note from cloud.', 'error');
    }
  };

  const shiftDayLogDate = (delta) => {
    const d = new Date(dayLogDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const newDate = getLocalDateString(d);
    setDayLogDate(newDate);
    fetchDayLogs(newDate);
  };

  const isToday = dayLogDate === getLocalDateString();

  // --- Authentication ---
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!loginPassword.trim()) return;
    setIsLoggingIn(true);
    try {
      localStorage.setItem('mg_auth_token', loginPassword.trim());
      // Test the password by calling status API
      const res = await apiService.getNeonStatus();
      setNeonAvailable(res.available);
      if (res.last_synced_at) setNeonLastSynced(res.last_synced_at);
      setIsAuthenticated(true);
      notify('Welcome back, Shlok!');
    } catch (err) {
      localStorage.removeItem('mg_auth_token');
      notify('Incorrect password. Please try again.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('mg_auth_token');
    setIsAuthenticated(false);
    setLoginPassword('');
    notify('Workspace locked.');
  };

  // --- Neon Sync ---
  const fetchNeonStatus = async () => {
    try {
      const res = await apiService.getNeonStatus();
      setNeonAvailable(res.available);
      if (res.last_synced_at) setNeonLastSynced(res.last_synced_at);
    } catch (_) {}
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchFiles();
      fetchThreads();
      fetchLogs('state');
      fetchTodayLogCount();
      fetchNeonStatus();
    }
  }, [isAuthenticated]);

  // ---------------------------------------------------------------- //
  // Render
  // ---------------------------------------------------------------- //
  const navItems = [
    { id: 'state',      label: 'State Manager',   icon: Database },
    { id: 'decision',   label: 'Decision Engine',  icon: Calendar },
    { id: 'reflection', label: 'Reflection',        icon: Sparkles },
    { id: 'logger',     label: 'Day Logger',        icon: NotebookPen },
    { id: 'chat',       label: 'Chat',              icon: MessageSquare },
    { id: 'files',      label: 'File Explorer',     icon: FileText },
  ];

  if (!isAuthenticated) {
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

  return (
    <div className="app-container">
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
          {navItems.map(({ id, label, icon: Icon }) => (
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

      {/* ---- Main ---- */}
      <div className="main-wrapper">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="mobile-menu-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="top-bar-title">
              {activeTab === 'state'      && 'State Manager'}
              {activeTab === 'decision'   && 'Decision Engine'}
              {activeTab === 'reflection' && 'Reflection Agent'}
              {activeTab === 'logger'     && 'Day Logger'}
              {activeTab === 'chat'       && 'Chat'}
              {activeTab === 'files'      && 'File Explorer'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} />
              <span className="date-display">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <button
              onClick={handleReconnect}
              className="btn btn-secondary"
              style={{
                padding: '6px 10px',
                minHeight: '32px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: backendConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                color: backendConnected ? 'var(--text-primary)' : 'var(--danger)',
              }}
              title="Check Connection & Reload API"
              disabled={checkingConnection}
            >
              <RefreshCw
                size={14}
                className={checkingConnection ? 'loading-spinner' : ''}
                style={{
                  color: checkingConnection
                    ? 'var(--accent-primary)'
                    : backendConnected
                    ? 'var(--success)'
                    : 'var(--danger)',
                }}
              />
              <span className="reconnect-btn-text">
                {checkingConnection ? 'Checking...' : backendConnected ? 'Online' : 'Offline'}
              </span>
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', minHeight: '32px', fontSize: '0.8rem' }}
              title="Lock Workspace"
            >
              Lock
            </button>
            {notification && (
              <div style={{
                padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem',
                display: 'flex', alignItems: 'center', gap: '8px',
                backgroundColor: notification.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
                color: notification.type === 'error' ? 'var(--danger)' : 'var(--success)',
                border: `1px solid ${notification.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
              }}>
                {notification.type === 'error' ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
                <span>{notification.text}</span>
              </div>
            )}
          </div>
        </header>

        <main className="content-body">

          {/* ===== STATE MANAGER ===== */}
          {activeTab === 'state' && (
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
                  {loadingState
                    ? <><RefreshCw size={16} className="loading-spinner" /><span>Updating knowledge base...</span></>
                    : <span>Update State</span>
                  }
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
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Past Updates</div>
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
          )}

          {/* ===== DECISION ENGINE ===== */}
          {activeTab === 'decision' && (
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
                  {loadingDecision
                    ? <><RefreshCw size={16} className="loading-spinner" /><span>Deciding...</span></>
                    : <span>Generate Plan</span>
                  }
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
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Past Plans</div>
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
          )}

          {/* ===== REFLECTION AGENT ===== */}
          {activeTab === 'reflection' && (
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
                  {loadingReflection
                    ? <><RefreshCw size={16} className="loading-spinner" /><span>Analyzing weekly logs...</span></>
                    : <span>Run Weekly Reflection</span>
                  }
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
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Past Reflections</div>
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
          )}

          {/* ===== DAY LOGGER ===== */}
          {activeTab === 'logger' && (
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
                    const dt = new Date(entry.created_at + (entry.isOptimistic ? '' : 'Z'));
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
          )}

          {/* ===== FILE EXPLORER ===== */}
          {activeTab === 'files' && (
            <div className="file-explorer">
              <div className="file-list">
                <div style={{ padding: '0 8px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Knowledge Base
                </div>
                {loadingFiles
                  ? <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}><RefreshCw size={18} className="loading-spinner" /></div>
                  : files.map(file => (
                    <div
                      key={file.name}
                      className={`file-item ${selectedFile === file.name ? 'active' : ''}`}
                      onClick={() => loadFile(file.name)}
                    >
                      <FileText size={15} style={{ opacity: 0.5 }} />
                      <span>{file.title || file.name}</span>
                    </div>
                  ))
                }
              </div>

              <div className="file-editor-container">
                {selectedFile ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                      <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedFile}</h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manual edit</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary" onClick={() => setIsEditing(!isEditing)}>
                          {isEditing ? <Eye size={15} /> : <Code size={15} />}
                          <span>{isEditing ? 'Preview' : 'Edit'}</span>
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={saveFile}
                          disabled={fileContent === originalFileContent}
                        >
                          <Save size={15} />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>

                    <div className="editor-panes" style={{ gridTemplateColumns: isEditing ? '1fr' : '1fr 1fr' }}>
                      {!isEditing && (
                        <textarea
                          className="editor-textarea"
                          value={fileContent}
                          onChange={e => setFileContent(e.target.value)}
                          placeholder="# Markdown"
                        />
                      )}
                      <div
                        className="markdown-preview markdown-body"
                        style={{ gridColumn: isEditing ? 'span 2' : 'span 1' }}
                        dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(fileContent) }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                    <FileText size={48} style={{ strokeWidth: 1, color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <h3>No file selected</h3>
                    <p style={{ fontSize: '0.85rem' }}>Select a file from the list to view or edit it.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== CHAT ===== */}
          {activeTab === 'chat' && (
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
                  {threads.length === 0
                    ? <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 4px' }}>No previous chats yet.</p>
                    : threads.map(tid => (
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
                  }
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
                        {msg.role === 'assistant'
                          ? <div className="markdown-body" dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(msg.content) }} />
                          : msg.content
                        }
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
          )}

        </main>
      </div>
      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3 className="modal-title">{confirmModal.title}</h3>
            <p className="modal-message">{confirmModal.message}</p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
