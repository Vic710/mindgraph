const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = { 
    'Content-Type': 'application/json', 
    ...options.headers 
  };
  
  const token = localStorage.getItem('mg_auth_token') || '';
  if (token) {
    headers['X-MindGraph-Token'] = token;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      if (err?.detail) errorMessage = err.detail;
    } catch (_) {}
    throw new Error(errorMessage);
  }
  return response.json();
}

export const apiService = {
  // Files
  getFiles: () => request('/api/files'),
  getFile: (name) => request(`/api/files/${name}`),
  updateFile: (name, content) => request(`/api/files/${name}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  }),
  createSnapshot: () => request('/api/files/snapshot', { method: 'POST' }),

  // Agents  — all take { text } and return { response: string }
  stateUpdate: (text) => request('/api/state/update', {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
  decisionGenerate: (text) => request('/api/decision/generate', {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),
  reflectionGenerate: (text = 'Run weekly reflection.') => request('/api/reflection/generate', {
    method: 'POST',
    body: JSON.stringify({ text }),
  }),

  // Chat — persistent per-thread memory via SQLite
  chat: (threadId, message) => request('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ thread_id: threadId, message }),
  }),
  listThreads: () => request('/api/chat/threads'),
  deleteThread: (threadId) => request(`/api/chat/${threadId}`, { method: 'DELETE' }),
  getChatHistory: (threadId) => request(`/api/chat/${threadId}/history`),

  // Agent Logs
  getLogs: (agent, limit = 30) => request(`/api/logs${agent ? `?agent=${agent}&limit=${limit}` : `?limit=${limit}`}`),
  deleteLog: (id) => request(`/api/logs/${id}`, { method: 'DELETE' }),

  // Day Logger — timestamped personal notes
  addDayLog: (note) => request('/api/daylog', { method: 'POST', body: JSON.stringify({ note }) }),
  getDayLogs: (date) => request(`/api/daylog${date ? `?date=${date}` : ''}`),
  deleteDayLog: (id) => request(`/api/daylog/${id}`, { method: 'DELETE' }),

  // Neon Sync
  pushToNeon: () => request('/api/neon/push', { method: 'POST' }),
  getNeonStatus: () => request('/api/neon/status'),
};
