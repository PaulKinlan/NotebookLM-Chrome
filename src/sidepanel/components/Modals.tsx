interface PickerModalProps {
  onClose: () => void;
  onAdd: () => void;
}

export function PickerModal(props: PickerModalProps) {
  const { onClose, onAdd } = props;

  return (
    <div id="picker-modal" className="modal hidden">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-content">
        <div className="modal-header">
          <h3 id="picker-title">Select Items</h3>
          <button id="picker-close" className="icon-btn" onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-search">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="picker-search" placeholder="Search..." />
        </div>
        <div id="picker-list" className="picker-list"></div>
        <div className="modal-footer">
          <span id="picker-selected-count">0 selected</span>
          <div className="modal-actions">
            <button id="picker-cancel" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button id="picker-add" className="btn btn-primary" onClick={onAdd}>
              Add Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface NotebookDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function NotebookDialog(props: NotebookDialogProps) {
  // Props are not used - this dialog is controlled by showNotebookDialog() Promise system
  // which dynamically attaches and removes event listeners
  const { onCancel, onConfirm } = props;

  return (
    <dialog id="notebook-dialog" className="dialog">
      <h3 id="notebook-dialog-title">New Notebook</h3>
      <input type="text" id="notebook-name-input" placeholder="Enter notebook name..." />
      <div className="dialog-actions">
        <button id="notebook-dialog-cancel" className="btn btn-outline">
          Cancel
        </button>
        <button id="notebook-dialog-confirm" className="btn btn-primary">
          Create
        </button>
      </div>
    </dialog>
  );
}

interface ConfirmDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Props are not used - this dialog is controlled by showConfirmDialog() Promise system
  // which dynamically attaches and removes event listeners
  const { onCancel, onConfirm } = props;

  return (
    <dialog id="confirm-dialog" className="dialog">
      <h3 id="confirm-dialog-title">Confirm</h3>
      <p id="confirm-dialog-message"></p>
      <div className="dialog-actions">
        <button id="confirm-dialog-cancel" className="btn btn-outline">
          Cancel
        </button>
        <button id="confirm-dialog-confirm" className="btn btn-danger">
          Delete
        </button>
      </div>
    </dialog>
  );
}
