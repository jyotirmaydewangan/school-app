const ReceiptRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RECEIPTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const receipts = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const receipt = {};
      headers.forEach((header, index) => {
        receipt[header] = row[index];
      });
      receipts.push(receipt);
    }
    
    if (options.invoice_id) {
      return receipts.filter(r => r.invoice_id == options.invoice_id);
    }
    
    if (options.transaction_id) {
      return receipts.filter(r => r.transaction_id == options.transaction_id);
    }
    
    if (options.student_id) {
      return receipts.filter(r => r.student_id == options.student_id);
    }
    
    return receipts;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RECEIPTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const receipt = {};
        headers.forEach((header, index) => {
          receipt[header] = data[i][index];
        });
        return receipt;
      }
    }
    return null;
  },

  findByReceiptNo(receiptNo) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RECEIPTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][3]) === String(receiptNo)) {
        const receipt = {};
        headers.forEach((header, index) => {
          receipt[header] = data[i][index];
        });
        return receipt;
      }
    }
    return null;
  },

  findByTransactionId(transactionId) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RECEIPTS);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(transactionId)) {
        const receipt = {};
        headers.forEach((header, index) => {
          receipt[header] = data[i][index];
        });
        return receipt;
      }
    }
    return null;
  },

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RECEIPTS);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const receiptNo = 'RCP-' + Date.now();
    
    const row = [
      id,
      data.transaction_id,
      data.invoice_id,
      receiptNo,
      data.student_id,
      data.amount,
      data.payment_mode || 'Online',
      now
    ];
    
    sheet.appendRow(row);
    return { id, receipt_no: receiptNo, ...data };
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.RECEIPTS);
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
