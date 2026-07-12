import React, { useState, useEffect, useRef } from 'react';
import { Clock, RefreshCw, AlertTriangle, CheckCircle, Menu } from 'lucide-react';
import { apiService } from './services/api';

// Utilities
import { getLocalDateString, getLocalISOString } from './components/utils';

// Subcomponents
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { ConfirmModal } from './components/ConfirmModal';
import { StateManager } from './components/StateManager';
import { DecisionEngine } from './components/DecisionEngine';
import { ReflectionAgent } from './components/ReflectionAgent';
import { DayLogger } from './components/DayLogger';
import { Chat } from './components/Chat';
import { FileExplorer } from './components/FileExplorer';

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
  const [mobileFileView, setMobileFileView] = useState('list'); // 'list' | 'editor'

  // Agent shared state
  const [stateInput, setStateInput] = useState('');
  const [stateResponse, setStateResponse] = useState('');
  const [loadingState, setLoadingState] = useState(false);

  // State Manager conversational session
  const [stateManagerThreadId, setStateManagerThreadId] = useState(() => {
    let tid = localStorage.getItem('mg_state_thread_id');
    if (!tid) {
      tid = crypto.randomUUID();
      localStorage.setItem('mg_state_thread_id', tid);
    }
    return tid;
  });
  const [stateManagerMessages, setStateManagerMessages] = useState([]);
  const [stateChatInput, setStateChatInput] = useState('');
  const [loadingStateChat, setLoadingStateChat] = useState(false);

  const [decisionInput, setDecisionInput] = useState('');
  const [decisionResponse, setDecisionResponse] = useState('');
  const [loadingDecision, setLoadingDecision] = useState(false);

  // Decision Engine conversational session
  const [decisionEngineThreadId, setDecisionEngineThreadId] = useState(() => {
    let tid = localStorage.getItem('mg_decision_thread_id');
    if (!tid) {
      tid = crypto.randomUUID();
      localStorage.setItem('mg_decision_thread_id', tid);
    }
    return tid;
  });
  const [decisionEngineMessages, setDecisionEngineMessages] = useState([]);
  const [decisionChatInput, setDecisionChatInput] = useState('');
  const [loadingDecisionChat, setLoadingDecisionChat] = useState(false);

  const [reflectionResponse, setReflectionResponse] = useState('');
  const [reflectionInput, setReflectionInput] = useState('');
  const [loadingReflection, setLoadingReflection] = useState(false);

  // Agent log history
  const [agentLogs, setAgentLogs] = useState({ state_manager: [], decision_engine: [], reflection: [] });
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  // Chat memory threads
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

  // --- Global Notification helper ---
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
      if (data.length > 0 && !selectedFile) loadFile(data[0].name, true);
    } catch {
      setBackendConnected(false);
      if (!silent) notify('Cannot reach backend API.', 'error');
    } finally {
      if (!silent) setLoadingFiles(false);
    }
  };

  const loadFile = async (name, isInitialLoad = false) => {
    try {
      const data = await apiService.getFile(name);
      setSelectedFile(name);
      setFileContent(data.content);
      setOriginalFileContent(data.content);
      setIsEditing(false);
      if (!isInitialLoad) {
        setMobileFileView('editor');
      }
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
      const res = await apiService.stateUpdate(stateInput, getLocalDateString(), stateManagerThreadId);
      setStateResponse(res.response);
      setStateInput('');
      notify('State updated successfully.');
      fetchFiles(true);
      fetchTodayLogCount();
      fetchLogs('state', true);
      fetchNeonStatus(); // Refresh sync timestamp
      fetchStateHistory(stateManagerThreadId);
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
      const res = await apiService.decisionGenerate(decisionInput, decisionEngineThreadId);
      setDecisionResponse(res.response);
      notify('Decision Engine generated your plan.');
      fetchLogs('decision');
      fetchNeonStatus(); // Refresh sync timestamp
      fetchDecisionHistory(decisionEngineThreadId);
    } catch (e) {
      notify(e.message || 'Decision Engine error.', 'error');
    } finally {
      setLoadingDecision(false);
    }
  };

  const fetchStateHistory = async (tid) => {
    try {
      const res = await apiService.getStateHistory(tid);
      setStateManagerMessages(res.messages || []);
      // Pre-set stateResponse if there is an active session
      if (res.messages && res.messages.length > 0) {
        // The last assistant message is the current active response
        const lastAssistant = [...res.messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) setStateResponse(lastAssistant.content);
      }
    } catch (_) {}
  };

  const fetchDecisionHistory = async (tid) => {
    try {
      const res = await apiService.getDecisionHistory(tid);
      setDecisionEngineMessages(res.messages || []);
      // Pre-set decisionResponse if there is an active session
      if (res.messages && res.messages.length > 0) {
        const lastAssistant = [...res.messages].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) setDecisionResponse(lastAssistant.content);
      }
    } catch (_) {}
  };

  const sendStateChatMessage = async () => {
    const text = stateChatInput.trim();
    if (!text || loadingStateChat) return;

    setStateManagerMessages(prev => [...prev, { role: 'user', content: text }]);
    setStateChatInput('');
    setLoadingStateChat(true);

    try {
      const res = await apiService.stateUpdate(text, getLocalDateString(), stateManagerThreadId);
      setStateManagerMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
      setStateResponse(res.response);
      fetchFiles(true);
      fetchTodayLogCount();
      fetchLogs('state', true);
      fetchNeonStatus();
    } catch (e) {
      setStateManagerMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setLoadingStateChat(false);
    }
  };

  const sendDecisionChatMessage = async () => {
    const text = decisionChatInput.trim();
    if (!text || loadingDecisionChat) return;

    setDecisionEngineMessages(prev => [...prev, { role: 'user', content: text }]);
    setDecisionChatInput('');
    setLoadingDecisionChat(true);

    try {
      const res = await apiService.decisionGenerate(text, decisionEngineThreadId);
      setDecisionEngineMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
      setDecisionResponse(res.response);
      fetchLogs('decision');
      fetchNeonStatus();
    } catch (e) {
      setDecisionEngineMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setLoadingDecisionChat(false);
    }
  };

  const lockStateSession = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Lock State Manager Session',
      message: 'Are you sure you want to lock and conclude today\'s state manager session? This will finalize all edits.',
      onConfirm: () => {
        const nextId = crypto.randomUUID();
        localStorage.setItem('mg_state_thread_id', nextId);
        setStateManagerThreadId(nextId);
        setStateManagerMessages([]);
        setStateResponse('');
        notify('Session finalized and locked.');
      }
    });
  };

  const lockDecisionSession = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Lock Decision Engine Session',
      message: 'Are you sure you want to conclude and lock this decision plan? This concludes today\'s plan generation.',
      onConfirm: () => {
        const nextId = crypto.randomUUID();
        localStorage.setItem('mg_decision_thread_id', nextId);
        setDecisionEngineThreadId(nextId);
        setDecisionEngineMessages([]);
        setDecisionResponse('');
        notify('Plan finalized and locked.');
      }
    });
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
  useEffect(() => {
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

  // Fetch relevant logs when switching to an active tab
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
    
    setDayLogInput('');
    dayLogInputRef.current?.focus();

    const tempId = `temp-${Date.now()}`;
    const optimisticEntry = {
      id: tempId,
      note: note,
      created_at: getLocalISOString(),
      isOptimistic: true
    };

    setDayLogs(prev => [optimisticEntry, ...prev]);
    setTodayLogCount(prev => prev + 1);

    try {
      const realEntry = await apiService.addDayLog(note, getLocalISOString());
      setDayLogs(prev => prev.map(item => item.id === tempId ? realEntry : item));
      fetchTodayLogCount();
      fetchNeonStatus();
    } catch (e) {
      setDayLogs(prev => prev.filter(item => item.id !== tempId));
      setTodayLogCount(prev => Math.max(0, prev - 1));
      notify(e.message || 'Failed to save note to cloud.', 'error');
    }
  };

  const deleteDayLogEntry = async (id) => {
    const originalLogs = [...dayLogs];
    setDayLogs(prev => prev.filter(l => l.id !== id));
    setTodayLogCount(prev => Math.max(0, prev - 1));

    try {
      await apiService.deleteDayLog(id);
      fetchNeonStatus();
    } catch (e) {
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
      fetchStateHistory(stateManagerThreadId);
      fetchDecisionHistory(decisionEngineThreadId);
    }
  }, [isAuthenticated, stateManagerThreadId, decisionEngineThreadId]);

  if (!isAuthenticated) {
    return (
      <Login
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        isLoggingIn={isLoggingIn}
        handleLogin={handleLogin}
        notification={notification}
      />
    );
  }

  return (
    <div className="app-container">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSunday={isSunday}
        todayLogCount={todayLogCount}
        neonAvailable={neonAvailable}
        neonLastSynced={neonLastSynced}
        triggerSnapshot={triggerSnapshot}
        loadingSnapshot={loadingSnapshot}
        backendConnected={backendConnected}
        handleReconnect={handleReconnect}
        checkingConnection={checkingConnection}
      />

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
          {activeTab === 'state' && (
            <StateManager
              stateInput={stateInput}
              setStateInput={setStateInput}
              loadingState={loadingState}
              submitStateUpdate={submitStateUpdate}
              stateResponse={stateResponse}
              agentLogs={agentLogs}
              loadingLogs={loadingLogs}
              expandedLogId={expandedLogId}
              setExpandedLogId={setExpandedLogId}
              todayLogCount={todayLogCount}
              backendConnected={backendConnected}
              stateManagerMessages={stateManagerMessages}
              stateChatInput={stateChatInput}
              setStateChatInput={setStateChatInput}
              sendStateChatMessage={sendStateChatMessage}
              loadingStateChat={loadingStateChat}
              lockStateSession={lockStateSession}
            />
          )}

          {activeTab === 'decision' && (
            <DecisionEngine
              decisionInput={decisionInput}
              setDecisionInput={setDecisionInput}
              loadingDecision={loadingDecision}
              submitDecision={submitDecision}
              decisionResponse={decisionResponse}
              agentLogs={agentLogs}
              loadingLogs={loadingLogs}
              expandedLogId={expandedLogId}
              setExpandedLogId={setExpandedLogId}
              backendConnected={backendConnected}
              decisionEngineMessages={decisionEngineMessages}
              decisionChatInput={decisionChatInput}
              setDecisionChatInput={setDecisionChatInput}
              sendDecisionChatMessage={sendDecisionChatMessage}
              loadingDecisionChat={loadingDecisionChat}
              lockDecisionSession={lockDecisionSession}
            />
          )}

          {activeTab === 'reflection' && (
            <ReflectionAgent
              reflectionInput={reflectionInput}
              setReflectionInput={setReflectionInput}
              loadingReflection={loadingReflection}
              submitReflection={submitReflection}
              reflectionResponse={reflectionResponse}
              agentLogs={agentLogs}
              loadingLogs={loadingLogs}
              expandedLogId={expandedLogId}
              setExpandedLogId={setExpandedLogId}
              isSunday={isSunday}
              backendConnected={backendConnected}
            />
          )}

          {activeTab === 'logger' && (
            <DayLogger
              dayLogInputRef={dayLogInputRef}
              dayLogInput={dayLogInput}
              setDayLogInput={setDayLogInput}
              addDayLogEntry={addDayLogEntry}
              backendConnected={backendConnected}
              shiftDayLogDate={shiftDayLogDate}
              dayLogDate={dayLogDate}
              isToday={isToday}
              loadingDayLogs={loadingDayLogs}
              dayLogs={dayLogs}
              deleteDayLogEntry={deleteDayLogEntry}
            />
          )}

          {activeTab === 'chat' && (
            <Chat
              threads={threads}
              chatThreadId={chatThreadId}
              switchThread={switchThread}
              startNewChat={startNewChat}
              deleteThreadEntry={deleteThreadEntry}
              chatMessages={chatMessages}
              loadingChat={loadingChat}
              chatEndRef={chatEndRef}
              chatInput={chatInput}
              setChatInput={setChatInput}
              sendChatMessage={sendChatMessage}
              backendConnected={backendConnected}
            />
          )}

          {activeTab === 'files' && (
            <FileExplorer
              mobileFileView={mobileFileView}
              setMobileFileView={setMobileFileView}
              loadingFiles={loadingFiles}
              files={files}
              selectedFile={selectedFile}
              loadFile={loadFile}
              fileContent={fileContent}
              setFileContent={setFileContent}
              originalFileContent={originalFileContent}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              saveFile={saveFile}
            />
          )}
        </main>
      </div>

      <ConfirmModal
        confirmModal={confirmModal}
        setConfirmModal={setConfirmModal}
      />
    </div>
  );
}
