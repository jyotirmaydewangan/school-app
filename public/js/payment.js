const PaymentService = {
  async createPaymentOrder(invoiceId) {
    try {
      const token = auth.getToken();
      if (!token) {
        throw new Error('Please login to make payment');
      }

      const result = await api.createPaymentOrder(token, invoiceId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to initiate payment');
      }

      return result;
    } catch (error) {
      console.error('Payment initiation error:', error);
      throw error;
    }
  },

  async initiatePayment(invoiceId) {
    try {
      const paymentData = await this.createPaymentOrder(invoiceId);
      
      if (paymentData.txnToken) {
        this.redirectToPaytmJS(paymentData);
      } else {
        throw new Error('Failed to get transaction token');
      }
    } catch (error) {
      console.error('Payment initiation error:', error);
      throw error;
    }
  },

  redirectToPaytmJS(paymentData) {
    const { orderId, txnToken, config } = paymentData;
    
    if (typeof Paytm === 'undefined') {
      throw new Error('Paytm SDK not loaded');
    }

    const paytmConfig = {
      root: window,
      style: {
        bodyBackgroundColor: "#f5f5f5",
        headerBackgroundColor: "#ffffff",
        headerColor: "#333333",
        btnBackgroundColor: "#2563eb",
        btnTextColor: "#ffffff",
        btnBorderColor: "#2563eb",
        linkColor: "#2563eb"
      }
    };

    Paytm(paytmConfig).then((Payment) => {
      Payment.startPayment({
        token: txnToken,
        orderId: orderId,
        amount: paymentData.amount,
        userDetail: {
          mobile: paymentData.invoice?.student_mobile || '',
          email: paymentData.invoice?.student_email || ''
        }
      }, (response) => {
        if (response.STATUS === 'TXN_SUCCESS') {
          window.location.href = `${config.callbackUrl}?orderId=${orderId}&status=success`;
        } else {
          window.location.href = `${config.callbackUrl}?orderId=${orderId}&status=failed`;
        }
      }, (error) => {
        console.error('Payment error:', error);
        window.location.href = `${config.callbackUrl}?orderId=${orderId}&status=error`;
      });
    });
  },

  async handlePaymentResult(orderId) {
    try {
      const token = auth.getToken();
      if (!token) {
        return { success: false, error: 'Please login to check payment status' };
      }

      const result = await api.verifyPayment(token, { order_id: orderId });
      return result;
    } catch (error) {
      console.error('Payment verification error:', error);
      return { success: false, error: error.message };
    }
  },

  async checkPaymentStatus(orderId) {
    try {
      const token = auth.getToken();
      const result = await api.getPaymentStatus(token, { order_id: orderId });
      return result;
    } catch (error) {
      console.error('Payment status check error:', error);
      return { success: false, error: error.message };
    }
  },

  async getInvoice(invoiceId) {
    try {
      const token = auth.getToken();
      const result = await api.getInvoices(token, { id: invoiceId });
      return result;
    } catch (error) {
      console.error('Get invoice error:', error);
      return { success: false, error: error.message };
    }
  },

  async getInvoices(options = {}) {
    try {
      const token = auth.getToken();
      const result = await api.getInvoices(token, options);
      return result;
    } catch (error) {
      console.error('Get invoices error:', error);
      return { success: false, error: error.message };
    }
  },

  async getReceipt(transactionId) {
    try {
      const token = auth.getToken();
      const result = await api.getReceipt(token, { transaction_id: transactionId });
      return result;
    } catch (error) {
      console.error('Get receipt error:', error);
      return { success: false, error: error.message };
    }
  },

  async getDashboardStats() {
    try {
      const token = auth.getToken();
      const result = await api.getDashboardStats(token);
      return result;
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      return { success: false, error: error.message };
    }
  },

  formatCurrency(amount) {
    return '₹' + parseFloat(amount).toFixed(2);
  },

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  getStatusBadgeClass(status) {
    const statusClasses = {
      'Draft': 'badge-secondary',
      'Sent': 'badge-info',
      'Pending': 'badge-warning',
      'Paid': 'badge-success',
      'Partially Paid': 'badge-warning',
      'Overdue': 'badge-danger',
      'Cancelled': 'badge-secondary',
      'Initiated': 'badge-info',
      'Processing': 'badge-info',
      'Success': 'badge-success',
      'Failed': 'badge-danger'
    };
    return statusClasses[status] || 'badge-secondary';
  },

  getInvoiceStates() {
    return {
      DRAFT: 'Draft',
      SENT: 'Sent',
      PAID: 'Paid',
      PARTIALLY_PAID: 'Partially Paid',
      OVERDUE: 'Overdue',
      CANCELLED: 'Cancelled'
    };
  }
};

const PaymentUI = {
  showInvoiceModal(invoice) {
    const modal = document.createElement('div');
    modal.className = 'modal fade show';
    modal.id = 'invoicePaymentModal';
    modal.style.display = 'block';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Invoice #${invoice.invoice_no}</h5>
            <button type="button" class="btn-close" onclick="PaymentUI.closeModal('invoicePaymentModal')"></button>
          </div>
          <div class="modal-body">
            <table class="table table-borderless">
              <tr>
                <td><strong>Student Name:</strong></td>
                <td>${invoice.student_name}</td>
              </tr>
              <tr>
                <td><strong>Class:</strong></td>
                <td>${invoice.class}</td>
              </tr>
              <tr>
                <td><strong>Description:</strong></td>
                <td>${invoice.description || 'N/A'}</td>
              </tr>
              <tr>
                <td><strong>Due Date:</strong></td>
                <td>${PaymentService.formatDate(invoice.due_date)}</td>
              </tr>
              <tr>
                <td><strong>Status:</strong></td>
                <td><span class="badge ${PaymentService.getStatusBadgeClass(invoice.status)}">${invoice.status}</span></td>
              </tr>
              <tr>
                <td><strong>Amount:</strong></td>
                <td><h4 class="text-success">${PaymentService.formatCurrency(invoice.amount)}</h4></td>
              </tr>
            </table>
          </div>
          <div class="modal-footer">
            ${invoice.status === 'Pending' || invoice.status === 'Sent' ? `
              <button type="button" class="btn btn-primary" onclick="PaymentUI.payInvoice('${invoice.id}')">
                <i class="bi bi-credit-card"></i> Pay Now
              </button>
            ` : ''}
            <button type="button" class="btn btn-secondary" onclick="PaymentUI.closeModal('invoicePaymentModal')">Close</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade show';
    backdrop.id = 'invoiceModalBackdrop';
    document.body.appendChild(backdrop);
  },

  async payInvoice(invoiceId) {
    try {
      this.closeModal('invoicePaymentModal');

      const loadingEl = document.createElement('div');
      loadingEl.id = 'paymentLoading';
      loadingEl.innerHTML = `
        <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;">
          <div class="text-center text-white">
            <div class="spinner-border" role="status"></div>
            <p class="mt-3">Redirecting to payment...</p>
          </div>
        </div>
      `;
      document.body.appendChild(loadingEl);

      await PaymentService.initiatePayment(invoiceId);

    } catch (error) {
      this.closeModal('invoicePaymentModal');
      alert(error.message);
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    const backdrop = document.getElementById(modalId === 'invoicePaymentModal' ? 'invoiceModalBackdrop' : null);

    if (modal) {
      modal.remove();
      document.body.classList.remove('modal-open');
    }
    if (backdrop) {
      backdrop.remove();
    }
  },

  showPaymentResult() {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('orderId');
    const status = params.get('status');

    if (orderId) {
      this.checkAndShowResult(orderId, status);
    }
  },

  async checkAndShowResult(orderId, status) {
    try {
      const result = await PaymentService.handlePaymentResult(orderId);

      const statusEl = document.getElementById('paymentStatus');
      if (statusEl) {
        let statusHtml = '';

        if (result.success && result.status === 'Paid') {
          statusHtml = `
            <div class="text-center">
              <i class="bi bi-check-circle-fill text-success" style="font-size: 64px;"></i>
              <h3 class="mt-3">Payment Successful!</h3>
              <p class="text-muted">Order ID: ${orderId}</p>
              <p>Amount: ${PaymentService.formatCurrency(result.amount)}</p>
              ${result.receipt ? `<p>Receipt: <strong>${result.receipt.receipt_no}</strong></p>` : ''}
              <a href="#" class="btn btn-primary mt-2" onclick="app.loadPage('invoices')">View Invoices</a>
            </div>
          `;
        } else {
          statusHtml = `
            <div class="text-center">
              <i class="bi bi-x-circle-fill text-danger" style="font-size: 64px;"></i>
              <h3 class="mt-3">Payment Failed</h3>
              <p class="text-muted">Order ID: ${orderId}</p>
              <p>${result.error || 'Please try again or contact support.'}</p>
              <a href="#" class="btn btn-secondary mt-2" onclick="app.loadPage('invoices')">Back to Invoices</a>
            </div>
          `;
        }

        statusEl.innerHTML = statusHtml;
      }
    } catch (error) {
      console.error('Error showing payment result:', error);
    }
  },

  renderInvoiceList(invoices, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!invoices || invoices.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">No invoices found.</p>';
      return;
    }

    container.innerHTML = invoices.map(inv => `
      <div class="card mb-2">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">Invoice #${inv.invoice_no}</h6>
              <small class="text-muted">${inv.student_name} - ${inv.class}</small>
            </div>
            <div class="text-end">
              <h5 class="mb-1">${PaymentService.formatCurrency(inv.amount)}</h5>
              <span class="badge ${PaymentService.getStatusBadgeClass(inv.status)}">${inv.status}</span>
            </div>
          </div>
          <div class="mt-2 d-flex justify-content-between">
            <small class="text-muted">Due: ${PaymentService.formatDate(inv.due_date)}</small>
            ${inv.status === 'Pending' || inv.status === 'Sent' ? `
              <button class="btn btn-sm btn-primary" onclick="PaymentService.initiatePayment('${inv.id}')">
                Pay Now
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  },

  renderDashboardStats(stats, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!stats) {
      container.innerHTML = '<p class="text-muted">Loading stats...</p>';
      return;
    }

    container.innerHTML = `
      <div class="row">
        <div class="col-md-3">
          <div class="card bg-primary text-white">
            <div class="card-body">
              <h5>Total Collection</h5>
              <h3>${PaymentService.formatCurrency(stats.totalCollection || 0)}</h3>
              <small>Target: ${PaymentService.formatCurrency(stats.targetCollection || 0)}</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card bg-success text-white">
            <div class="card-body">
              <h5>Paid</h5>
              <h3>${PaymentService.formatCurrency(stats.paidAmount || 0)}</h3>
              <small>${stats.paidCount || 0} invoices</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card bg-warning text-dark">
            <div class="card-body">
              <h5>Pending</h5>
              <h3>${PaymentService.formatCurrency(stats.pendingAmount || 0)}</h3>
              <small>${stats.pendingCount || 0} invoices</small>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="card bg-danger text-white">
            <div class="card-body">
              <h5>Overdue</h5>
              <h3>${PaymentService.formatCurrency(stats.overdueAmount || 0)}</h3>
              <small>${stats.overdueCount || 0} invoices</small>
            </div>
          </div>
        </div>
      </div>
      <div class="row mt-3">
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h6>Payment Channel Analytics</h6>
            </div>
            <div class="card-body">
              <div class="d-flex justify-content-between mb-2">
                <span>UPI</span>
                <span class="badge bg-primary">${stats.channelAnalytics?.upi || 0}%</span>
              </div>
              <div class="d-flex justify-content-between mb-2">
                <span>Cards</span>
                <span class="badge bg-info">${stats.channelAnalytics?.cards || 0}%</span>
              </div>
              <div class="d-flex justify-content-between">
                <span>Net Banking</span>
                <span class="badge bg-secondary">${stats.channelAnalytics?.netBanking || 0}%</span>
              </div>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="card">
            <div class="card-header">
              <h6>Revenue Leakage</h6>
            </div>
            <div class="card-body">
              <p>Total Discounts: <strong>${PaymentService.formatCurrency(stats.totalDiscounts || 0)}</strong></p>
              <p>Total Waivers: <strong>${PaymentService.formatCurrency(stats.totalWaivers || 0)}</strong></p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') {
  window.PaymentService = PaymentService;
  window.PaymentUI = PaymentUI;
}

async function loadPaymentConfig() {
  const modal = document.getElementById('paymentConfigModal');
  const form = document.getElementById('paymentConfigForm');
  
  if (!modal || !form) {
    console.error('Payment config modal not found');
    return;
  }

  const token = auth.getToken();
  if (!token) {
    Toast.show('Please login to configure payment settings', 'error');
    return;
  }

  try {
    const result = await api.getPaymentConfig(token);
    
    if (result.success && result.config) {
      const config = result.config;
      document.getElementById('paytmStaging').value = config.staging === true || config.staging === 'true' ? 'true' : 'false';
      document.getElementById('paytmMid').value = config.mid || '';
      document.getElementById('paytmMerchantKey').value = '';
      document.getElementById('paytmWebsite').value = config.website || 'WEBSTAGING';
      document.getElementById('paytmIndustryType').value = config.industryType || 'Retail';
      document.getElementById('paytmCallbackUrl').value = config.callbackUrl || '';
    } else {
      document.getElementById('paytmStaging').value = 'true';
      document.getElementById('paytmMid').value = '';
      document.getElementById('paytmMerchantKey').value = '';
      document.getElementById('paytmWebsite').value = 'WEBSTAGING';
      document.getElementById('paytmIndustryType').value = 'Retail';
      document.getElementById('paytmCallbackUrl').value = '';
    }
  } catch (error) {
    console.error('Error loading payment config:', error);
    Toast.show('Failed to load payment configuration', 'error');
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closePaymentConfigModal() {
  const modal = document.getElementById('paymentConfigModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('paymentConfigForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const token = auth.getToken();
      if (!token) {
        Toast.show('Please login to save payment settings', 'error');
        return;
      }

      const configData = {
        staging: document.getElementById('paytmStaging').value === 'true',
        mid: document.getElementById('paytmMid').value.trim(),
        merchantKey: document.getElementById('paytmMerchantKey').value.trim(),
        website: document.getElementById('paytmWebsite').value.trim(),
        industryType: document.getElementById('paytmIndustryType').value.trim(),
        callbackUrl: document.getElementById('paytmCallbackUrl').value.trim()
      };

      if (!configData.mid || !configData.merchantKey) {
        Toast.show('Please fill in Merchant ID and Merchant Key', 'error');
        return;
      }

      try {
        const result = await api.savePaymentConfig(token, configData);
        
        if (result.success) {
          Toast.show('Payment configuration saved successfully', 'success');
          closePaymentConfigModal();
        } else {
          Toast.show(result.error || 'Failed to save payment configuration', 'error');
        }
      } catch (error) {
        console.error('Error saving payment config:', error);
        Toast.show('Failed to save payment configuration', 'error');
      }
    });
  }

  PaymentUI.showPaymentResult();
});
