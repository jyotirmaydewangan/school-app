const TransactionRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TRANSACTIONS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const transactions = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const transaction = {};
      headers.forEach((header, index) => {
        transaction[header] = row[index];
      });
      transactions.push(transaction);
    }
    
    if (options.invoice_id) {
      return transactions.filter(t => t.invoice_id == options.invoice_id);
    }
    
    if (options.order_id) {
      return transactions.filter(t => t.order_id === options.order_id);
    }
    
    if (options.status) {
      return transactions.filter(t => t.status === options.status);
    }
    
    return transactions;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TRANSACTIONS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const transaction = {};
        headers.forEach((header, index) => {
          transaction[header] = data[i][index];
        });
        return transaction;
      }
    }
    return null;
  },

  findByOrderId(orderId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TRANSACTIONS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]) === String(orderId)) {
        const transaction = {};
        headers.forEach((header, index) => {
          transaction[header] = data[i][index];
        });
        return transaction;
      }
    }
    return null;
  },

  findByInvoiceId(invoiceId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TRANSACTIONS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const transactions = [];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(invoiceId)) {
        const transaction = {};
        headers.forEach((header, index) => {
          transaction[header] = data[i][index];
        });
        transactions.push(transaction);
      }
    }
    return transactions;
  },

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TRANSACTIONS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.invoice_id,
      data.order_id,
      data.txn_token || '',
      data.amount,
      data.mode || 'Online',
      data.status || 'Initiated',
      data.transaction_id || '',
      data.paytm_response || '',
      data.checksum_verified || false,
      now,
      now,
      data.payment_mode || '',
      data.bank_name || ''
    ];
    
    sheet.appendRow(row);
    return { id, ...data };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TRANSACTIONS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === String(id)) {
        headers.forEach((header, index) => {
          if (data[header] !== undefined) {
            values[i][index] = data[header];
          }
        });
        values[i][11] = new Date().toISOString();
        sheet.getRange(i + 1, 1, 1, values[0].length).setValues([values[i]]);
        return true;
      }
    }
    return false;
  },

  updateByOrderId(orderId, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TRANSACTIONS);
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][2]) === String(orderId)) {
        headers.forEach((header, index) => {
          if (data[header] !== undefined) {
            values[i][index] = data[header];
          }
        });
        values[i][11] = new Date().toISOString();
        sheet.getRange(i + 1, 1, 1, values[0].length).setValues([values[i]]);
        return true;
      }
    }
    return false;
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.TRANSACTIONS);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  }
};
