const INVOICE_STATUS = Object.freeze({
  DRAFT: 'Draft',
  SENT: 'Sent',
  PAID: 'Paid',
  PARTIALLY_PAID: 'Partially Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled'
});

const InvoiceRepository = {
  findAll(options = {}) {
    const sheet = SheetService.getSheet(SHEET_NAMES.INVOICES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const invoices = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const invoice = {};
      headers.forEach((header, index) => {
        invoice[header] = row[index];
      });
      invoices.push(invoice);
    }
    
    if (options.student_id) {
      return invoices.filter(inv => inv.student_id == options.student_id);
    }
    
    if (options.status) {
      return invoices.filter(inv => inv.status === options.status);
    }
    
    if (options.academic_year) {
      return invoices.filter(inv => inv.academic_year === options.academic_year);
    }
    
    if (options.class) {
      return invoices.filter(inv => inv.class === options.class);
    }
    
    return invoices;
  },

  findById(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.INVOICES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        const invoice = {};
        headers.forEach((header, index) => {
          invoice[header] = data[i][index];
        });
        return invoice;
      }
    }
    return null;
  },

  findByInvoiceNo(invoiceNo) {
    const sheet = SheetService.getSheet(SHEET_NAMES.INVOICES);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === String(invoiceNo)) {
        const invoice = {};
        headers.forEach((header, index) => {
          invoice[header] = data[i][index];
        });
        return invoice;
      }
    }
    return null;
  },

  getPendingInvoices(studentId) {
    return this.findAll({ student_id: studentId }).filter(
      inv => inv.status === INVOICE_STATUS.SENT || inv.status === INVOICE_STATUS.OVERDUE
    );
  },

  getOverdueInvoices() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.findAll().filter(inv => {
      if (inv.status === INVOICE_STATUS.PAID || inv.status === INVOICE_STATUS.CANCELLED) {
        return false;
      }
      if (inv.due_date) {
        const dueDate = new Date(inv.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
      }
      return false;
    });
  },

  create(data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.INVOICES);
    const id = Utilities.getUuid();
    const now = new Date().toISOString();
    
    const row = [
      id,
      data.invoice_no || 'INV-' + Date.now(),
      data.student_id,
      data.student_name,
      data.class,
      data.academic_year || new Date().getFullYear().toString(),
      data.amount,
      data.description || '',
      data.due_date,
      data.status || INVOICE_STATUS.DRAFT,
      now,
      null,
      data.created_by || ''
    ];
    
    sheet.appendRow(row);
    return { id, ...data };
  },

  bulkCreate(invoicesData, createdBy) {
    const sheet = SheetService.getSheet(SHEET_NAMES.INVOICES);
    const now = new Date().toISOString();
    const created = [];
    
    invoicesData.forEach(data => {
      const id = Utilities.getUuid();
      const row = [
        id,
        data.invoice_no || 'INV-' + Date.now(),
        data.student_id,
        data.student_name,
        data.class,
        data.academic_year || new Date().getFullYear().toString(),
        data.amount,
        data.description || '',
        data.due_date,
        data.status || INVOICE_STATUS.DRAFT,
        now,
        null,
        createdBy || ''
      ];
      sheet.appendRow(row);
      created.push({ id, ...data });
    });
    
    return created;
  },

  generateFromFeeStructure(className, academicYear, dueDate, createdBy) {
    const feeStructures = FeeStructureRepository.findByClassAndYear(className, academicYear);
    if (feeStructures.length === 0) {
      return { success: false, error: 'No fee structure found for class ' + className };
    }

    const students = StudentRepository.findAll({ class: className });
    if (students.length === 0) {
      return { success: false, error: 'No students found in class ' + className };
    }

    const invoicesData = [];
    const totalAmount = feeStructures.reduce((sum, fs) => sum + parseFloat(fs.amount || 0), 0);
    const invoiceNo = 'INV-' + academicYear + '-' + Date.now();

    students.forEach(student => {
      invoicesData.push({
        invoice_no: invoiceNo + '-' + student.id.substring(0, 8),
        student_id: student.id,
        student_name: student.name,
        class: className,
        academic_year: academicYear,
        amount: totalAmount,
        description: feeStructures.map(fs => fs.name).join(', '),
        due_date: dueDate,
        status: INVOICE_STATUS.SENT,
        created_by: createdBy
      });
    });

    const created = this.bulkCreate(invoicesData, createdBy);
    return { success: true, count: created.length, invoices: created };
  },

  generateSchoolWide(academicYear, dueDate, createdBy) {
    const classes = ClassRepository.findAll();
    const allInvoices = [];

    classes.forEach(cls => {
      const result = this.generateFromFeeStructure(cls.name, academicYear, dueDate, createdBy);
      if (result.success) {
        allInvoices.push(...result.invoices);
      }
    });

    return { success: true, count: allInvoices.length, invoices: allInvoices };
  },

  update(id, data) {
    const sheet = SheetService.getSheet(SHEET_NAMES.INVOICES);
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
        sheet.getRange(i + 1, 1, 1, values[0].length).setValues([values[i]]);
        return true;
      }
    }
    return false;
  },

  markAsPaid(id, paidAt = null) {
    return this.update(id, {
      status: INVOICE_STATUS.PAID,
      paid_at: paidAt || new Date().toISOString()
    });
  },

  markAsSent(id) {
    return this.update(id, { status: INVOICE_STATUS.SENT });
  },

  markAsOverdue(id) {
    return this.update(id, { status: INVOICE_STATUS.OVERDUE });
  },

  markAsCancelled(id) {
    return this.update(id, { status: INVOICE_STATUS.CANCELLED });
  },

  delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.INVOICES);
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
