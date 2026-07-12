import React from 'react';
import { FileText, ChevronLeft, Eye, Code, Save, RefreshCw } from 'lucide-react';
import { parseMarkdownToHtml } from './Markdown';

export function FileExplorer({
  mobileFileView,
  setMobileFileView,
  loadingFiles,
  files,
  selectedFile,
  loadFile,
  fileContent,
  setFileContent,
  originalFileContent,
  isEditing,
  setIsEditing,
  saveFile
}) {
  return (
    <div className={`file-explorer ${mobileFileView === 'list' ? 'show-list' : 'show-editor'}`}>
      <div className="file-list">
        <div style={{ padding: '0 8px', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '10px' }}>
          Knowledge Base
        </div>
        {loadingFiles ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
            <RefreshCw size={18} className="loading-spinner" />
          </div>
        ) : (
          files.map(file => (
            <button
              key={file.name}
              className={`file-item ${selectedFile === file.name ? 'active' : ''}`}
              onClick={() => loadFile(file.name)}
            >
              <FileText size={15} style={{ opacity: 0.5 }} />
              <span>{file.title || file.name}</span>
            </button>
          ))
        )}
      </div>

      <div className="file-editor-container">
        {selectedFile ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn btn-secondary mobile-back-btn"
                  onClick={() => setMobileFileView('list')}
                  style={{ padding: '6px 8px', minHeight: '32px' }}
                >
                  <ChevronLeft size={16} />
                  <span>Files</span>
                </button>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{selectedFile}</h2>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manual edit</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary desktop-edit-toggle" onClick={() => setIsEditing(!isEditing)}>
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

            <div className="mobile-editor-tabs">
              <button
                className={`mobile-tab-btn ${!isEditing ? 'active' : ''}`}
                onClick={() => setIsEditing(false)}
              >
                Edit
              </button>
              <button
                className={`mobile-tab-btn ${isEditing ? 'active' : ''}`}
                onClick={() => setIsEditing(true)}
              >
                Preview
              </button>
            </div>

            <div className={`editor-panes ${isEditing ? 'show-preview' : 'show-edit'}`}>
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
  );
}
