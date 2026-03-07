class ConfirmDialog {
  constructor() {
    this.defaultOptions = {
      title: 'Confirm',
      message: 'Are you sure?',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      type: 'warning'
    };
  }

  show(message, options = {}) {
    const config = { ...this.defaultOptions, ...options, message };
    return this.showNative(message, config);
  }

  showNative(message, options) {
    const icons = {
      warning: '⚠️',
      danger: '🔴',
      info: 'ℹ️',
      success: '✅'
    };
    const icon = icons[options.type] || icons.warning;
    return confirm(`${icon} ${message}`);
  }

  async showAsync(message, options = {}) {
    return new Promise((resolve) => {
      const result = this.show(message, options);
      resolve(result);
    });
  }

  danger(message, options = {}) {
    return this.show(message, { ...options, type: 'danger' });
  }

  warning(message, options = {}) {
    return this.show(message, { ...options, type: 'warning' });
  }

  info(message, options = {}) {
    return this.show(message, { ...options, type: 'info' });
  }

  success(message, options = {}) {
    return this.show(message, { ...options, type: 'success' });
  }
}

const confirmDialog = new ConfirmDialog();

if (typeof window !== 'undefined') {
  window.ConfirmDialog = ConfirmDialog;
  window.confirmDialog = confirmDialog;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConfirmDialog, confirmDialog };
}
