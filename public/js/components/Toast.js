class Toast {
  constructor(options = {}) {
    this.defaultDuration = options.duration || 4000;
    this.container = null;
  }

  init() {
    if (!this.container && document.body) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  ensureContainer() {
    if (!this.container) {
      this.init();
    }
    if (!this.container && document.body) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(message, type = 'info', options = {}) {
    const { duration = this.defaultDuration, icon } = options;
    
    const container = this.ensureContainer();
    if (!container) return null;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-times-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    const iconClass = icon || (icons[type] || icons.info);

    toast.innerHTML = `
      <i class="fas ${iconClass} toast-icon"></i>
      <span class="toast-message">${this.escapeHtml(message)}</span>
      <i class="fas fa-times toast-close"></i>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.remove(toast));

    this.    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this.remove(toast), duration);
    }

    return toast;
  }

  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  error(message, options = {}) {
    return this.show(message, 'error', { ...options, duration: options.duration || 6000 });
  }

  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  remove(toast) {
    if (!toast || !toast.parentNode) return;
    
    toast.classList.add('toast-exit');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  clear() {
    this.container.innerHTML = '';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const toast = new Toast();

if (typeof window !== 'undefined') {
  window.Toast = Toast;
  window.toast = toast;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Toast, toast };
}
