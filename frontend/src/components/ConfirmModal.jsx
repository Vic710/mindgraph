import React from 'react';

export function ConfirmModal({ confirmModal, setConfirmModal }) {
  if (!confirmModal.isOpen) return null;
  
  return (
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
            className="btn btn-primary btn-danger"
            onClick={() => {
              if (confirmModal.onConfirm) confirmModal.onConfirm();
              setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
