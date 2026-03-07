class Modal {
  constructor(modalId, options = {}) {
    this.modalId = modalId;
    this.modal = null;
    this.options = {
      closeOnOverlayClick: options.closeOnOverlayClick ?? true,
      closeOnEscape: options.closeOnEscape ?? true,
      onOpen: options.onOpen || null,
      onClose: options.onClose || null
    };
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.findModal());
    } else {
      this.findModal();
    }
  }

  findModal() {
    this.modal = document.getElementById(this.modalId);
    if (!this.modal) {
      console.warn(`Modal with id "${this.modalId}" not found`);
      return;
    }

    const closeBtn = this.modal.querySelector('[data-modal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (this.options.closeOnOverlayClick) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.close();
        }
      });
    }

    if (this.options.closeOnEscape) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen()) {
          this.close();
        }
      });
    }
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.add('show');
    if (this.options.onOpen) {
      this.options.onOpen(this);
    }
    this.emit('open', this);
  }

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('show');
    if (this.options.onClose) {
      this.options.onClose(this);
    }
    this.emit('close', this);
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  isOpen() {
    return this.modal && this.modal.classList.contains('show');
  }

  setContent(html) {
    const contentEl = this.modal.querySelector('[data-modal-content]');
    if (contentEl) {
      contentEl.innerHTML = html;
    }
  }

  setTitle(title) {
    const titleEl = this.modal.querySelector('[data-modal-title]');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  getForm() {
    return this.modal.querySelector('form');
  }

  getField(fieldId) {
    return document.getElementById(fieldId);
  }

  setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = value;
    }
  }

  getFieldValue(fieldId) {
    const field = document.getElementById(fieldId);
    return field ? field.value : null;
  }

  reset() {
    const form = this.getForm();
    if (form) {
      form.reset();
    }
  }

  showLoading() {
    const contentEl = this.modal.querySelector('[data-modal-content]');
    if (contentEl) {
      contentEl.innerHTML = '<div class="flex justify-center p-4"><i class="fas fa-spinner fa-spin text-2xl"></i></div>';
    }
  }

  hideLoading() {
    const contentEl = this.modal.querySelector('[data-modal-content]');
    if (contentEl) {
      contentEl.innerHTML = '';
    }
  }

  enable() {
    const form = this.getForm();
    if (form) {
      const buttons = form.querySelectorAll('button, input[type="submit"]');
      buttons.forEach(btn => btn.disabled = false);
    }
  }

  disable() {
    const form = this.getForm();
    if (form) {
      const buttons = form.querySelectorAll('button, input[type="submit"]');
      buttons.forEach(btn => btn.disabled = true);
    }
  }

  on(event, callback) {
    if (!this.listeners) this.listeners = {};
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners && this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
}

class ModalManager {
  constructor() {
    this.modals = {};
  }

  register(modalId, options) {
    this.modals[modalId] = new Modal(modalId, options);
    return this.modals[modalId];
  }

  get(modalId) {
    if (!this.modals[modalId]) {
      this.register(modalId);
    }
    return this.modals[modalId];
  }

  open(modalId) {
    const modal = this.get(modalId);
    modal.open();
  }

  close(modalId) {
    const modal = this.get(modalId);
    modal.close();
  }

  closeAll() {
    Object.values(this.modals).forEach(modal => modal.close());
  }
}

const modalManager = new ModalManager();

if (typeof window !== 'undefined') {
  window.Modal = Modal;
  window.ModalManager = ModalManager;
  window.modalManager = modalManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Modal, ModalManager, modalManager };
}
