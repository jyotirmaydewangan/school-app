const PaytmPayments = {
  getConfig() {
    const staging = ConfigService.get('paytm_staging', 'true') === 'true';
    return {
      mid: ConfigService.get('paytm_mid', ''),
      merchantKey: ConfigService.get('paytm_merchant_key', ''),
      website: staging ? 'WEBSTAGING' : ConfigService.get('paytm_website', 'DEFAULT'),
      industryType: staging ? 'Retail' : ConfigService.get('paytm_industry_type', 'E-Commerce'),
      callbackUrl: ConfigService.get('paytm_callback_url', ''),
      staging: staging
    };
  },

  generateChecksum(orderId, amount, customerInfo) {
    const config = this.getConfig();
    if (!config.mid || !config.merchantKey) {
      return { success: false, error: 'Payment gateway not configured' };
    }
    
    try {
      const paytmParams = {
        MID: config.mid,
        ORDER_ID: orderId,
        CUST_ID: customerInfo.customerId || 'CUST_' + orderId,
        MOBILE_NO: customerInfo.mobile || '',
        EMAIL: customerInfo.email || '',
        CHANNEL_ID: 'WEB',
        TXN_AMOUNT: amount.toString(),
        WEBSITE: config.website,
        INDUSTRY_TYPE_ID: config.industryType,
        CALLBACK_URL: config.callbackUrl
      };

      const checksum = this._createChecksum(paytmParams, config.merchantKey);
      
      return {
        success: true,
        checksum: checksum,
        params: paytmParams,
        config: {
          mid: config.mid,
          orderId: orderId,
          callbackUrl: config.callbackUrl,
          staging: config.staging
        }
      };
    } catch (e) {
      Logger.log('Generate Checksum Error: ' + e.message);
      return { success: false, error: e.message };
    }
  },

  _createChecksum(params, key) {
    const paytmCheckSum = require('@paytm/paytmchecksum');
    return paytmCheckSum.generateSignature(JSON.stringify(params), key);
  },

  verifyChecksum(responseParams, key) {
    const paytmCheckSum = require('@paytm/paytmchecksum');
    return paytmCheckSum.verifySignature(responseParams, key);
  },

  initiateTransaction(orderId, amount, customerInfo) {
    const config = this.getConfig();
    if (!config.mid || !config.merchantKey) {
      return { success: false, error: 'Payment gateway not configured' };
    }

    const staging = config.staging;
    const txnUrl = staging 
      ? 'https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction?orderId=' + orderId
      : 'https://secure.paytm.in/theia/api/v1/initiateTransaction?orderId=' + orderId;

    const paytmParams = {
      MID: config.mid,
      ORDER_ID: orderId,
      CUST_ID: customerInfo.customerId || 'CUST_' + orderId,
      MOBILE_NO: customerInfo.mobile || '',
      EMAIL: customerInfo.email || '',
      CHANNEL_ID: 'WEB',
      TXN_AMOUNT: amount.toString(),
      WEBSITE: config.website,
      INDUSTRY_TYPE_ID: config.industryType,
      CALLBACK_URL: config.callbackUrl
    };

    try {
      const checksum = this._createChecksum(paytmParams, config.merchantKey);
      paytmParams['CHECKSUMHASH'] = checksum;

      const options = {
        method: 'post',
        payload: JSON.stringify(paytmParams),
        headers: { 'Content-Type': 'application/json' }
      };

      const response = UrlFetchApp.fetch(txnUrl, options);
      const result = JSON.parse(response.getContentText());

      if (result.STATUS === 'TXN_SUCCESS' && result.TXNAMOUNT) {
        return {
          success: true,
          txnToken: result.TXNTOKEN,
          orderId: orderId,
          amount: result.TXNAMOUNT,
          config: {
            mid: config.mid,
            orderId: orderId,
            callbackUrl: config.callbackUrl,
            staging: staging
          }
        };
      } else {
        return { success: false, error: result.RESPMSG || 'Failed to initiate transaction' };
      }
    } catch (e) {
      Logger.log('Initiate Transaction Error: ' + e.message);
      return { success: false, error: e.message };
    }
  },

  getTransactionStatus(orderId) {
    const config = this.getConfig();
    if (!config.mid || !config.merchantKey) {
      return { success: false, error: 'Payment gateway not configured' };
    }

    const staging = config.staging;
    const statusUrl = staging
      ? 'https://securegw-stage.paytm.in/v3/orderstatus.json'
      : 'https://secure.paytm.in/v3/orderstatus.json';

    const paytmParams = {
      MID: config.mid,
      ORDERID: orderId
    };

    try {
      const checksum = this._createChecksum(paytmParams, config.merchantKey);
      paytmParams['CHECKSUMHASH'] = checksum;

      const options = {
        method: 'post',
        payload: JSON.stringify(paytmParams),
        headers: { 'Content-Type': 'application/json' }
      };

      const response = UrlFetchApp.fetch(statusUrl, options);
      const result = JSON.parse(response.getContentText());

      return {
        success: true,
        status: result.STATUS,
        response: result
      };
    } catch (e) {
      Logger.log('Get Transaction Status Error: ' + e.message);
      return { success: false, error: e.message };
    }
  },

  verifyAndReconcile(orderId) {
    const transaction = TransactionRepository.findByOrderId(orderId);
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    const statusResult = this.getTransactionStatus(orderId);
    if (!statusResult.success) {
      return { success: false, error: statusResult.error };
    }

    const paytmResponse = statusResult.response;
    const isSuccess = paytmResponse.STATUS === 'TXN_SUCCESS';

    TransactionRepository.updateByOrderId(orderId, {
      status: isSuccess ? 'Success' : 'Failed',
      transaction_id: paytmResponse.TXNID || '',
      paytm_response: JSON.stringify(paytmResponse),
      checksum_verified: true
    });

    if (isSuccess) {
      const invoice = InvoiceRepository.findById(transaction.invoice_id);
      if (invoice) {
        InvoiceRepository.markAsPaid(invoice.id, new Date().toISOString());
        
        ReceiptRepository.create({
          transaction_id: transaction.id,
          invoice_id: transaction.invoice_id,
          student_id: invoice.student_id,
          amount: paytmResponse.TXNAMOUNT,
          payment_mode: paytmResponse.PAYMENTMODE || 'Online'
        });
      }

      return {
        success: true,
        status: 'Paid',
        transaction_id: paytmResponse.TXNID,
        amount: paytmResponse.TXNAMOUNT
      };
    }

    return {
      success: false,
      status: paytmResponse.STATUS,
      error: paytmResponse.RESPMSG
    };
  },

  handleCallback(formData) {
    try {
      const orderId = formData.ORDERID;
      const transaction = TransactionRepository.findByOrderId(orderId);
      
      if (!transaction) {
        Logger.log('Callback: Transaction not found for order ' + orderId);
        return { success: false, error: 'Transaction not found' };
      }

      const config = this.getConfig();
      const isValidChecksum = this._verifyChecksum(formData, config.merchantKey);

      if (!isValidChecksum) {
        Logger.log('Callback: Invalid checksum for order ' + orderId);
        TransactionRepository.updateByOrderId(orderId, {
          status: 'Failed',
          checksum_verified: false,
          paytm_response: JSON.stringify(formData)
        });
        return { success: false, error: 'Invalid checksum' };
      }

      const isSuccess = formData.RESPCODE === '01';
      
      TransactionRepository.updateByOrderId(orderId, {
        status: isSuccess ? 'Success' : 'Failed',
        transaction_id: formData.TXNID || '',
        paytm_response: JSON.stringify(formData),
        checksum_verified: true
      });

      if (isSuccess) {
        const invoice = InvoiceRepository.findById(transaction.invoice_id);
        if (invoice) {
          InvoiceRepository.markAsPaid(invoice.id, new Date().toISOString());
          
          ReceiptRepository.create({
            transaction_id: transaction.id,
            invoice_id: transaction.invoice_id,
            student_id: invoice.student_id,
            amount: formData.TXNAMOUNT,
            payment_mode: formData.PAYMENTMODE || 'Online'
          });
        }

        Logger.log('Payment reconciled successfully for order ' + orderId);
        return { success: true, status: 'Paid', orderId: orderId };
      }

      return { success: false, status: formData.STATUS, error: formData.RESPMSG };
    } catch (e) {
      Logger.log('Callback Error: ' + e.message);
      return { success: false, error: e.message };
    }
  },

  _verifyChecksum(params, key) {
    const paytmCheckSum = require('@paytm/paytmchecksum');
    return paytmCheckSum.verifySignature(params, key);
  }
};

const PaymentHandler = {
  createOrder(invoiceId, userInfo) {
    const invoice = InvoiceRepository.findById(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.status === INVOICE_STATUS.PAID) {
      return { success: false, error: 'Invoice already paid' };
    }

    const orderId = 'ORD-' + invoiceId.substring(0, 8) + '-' + Date.now();
    const customerInfo = {
      customerId: userInfo.id || invoice.student_id,
      mobile: userInfo.phone || '',
      email: userInfo.email || ''
    };

    const transaction = TransactionRepository.create({
      invoice_id: invoiceId,
      order_id: orderId,
      amount: invoice.amount,
      mode: 'Online',
      status: 'Initiated'
    });

    const initiateResult = PaytmPayments.initiateTransaction(orderId, invoice.amount, customerInfo);
    
    if (!initiateResult.success) {
      TransactionRepository.updateByOrderId(orderId, {
        status: 'Failed',
        txn_token: '',
        paytm_response: JSON.stringify({ error: initiateResult.error })
      });
      return initiateResult;
    }

    TransactionRepository.updateByOrderId(orderId, {
      txn_token: initiateResult.txnToken,
      status: 'Processing'
    });

    return {
      success: true,
      orderId: orderId,
      txnToken: initiateResult.txnToken,
      amount: initiateResult.amount,
      invoice: invoice,
      config: initiateResult.config
    };
  },

  verifyPayment(orderId) {
    return PaytmPayments.verifyAndReconcile(orderId);
  },

  getPaymentConfig() {
    const config = PaytmPayments.getConfig();
    return {
      success: true,
      config: {
        staging: config.staging,
        mid: config.mid ? config.mid.substring(0, 4) + '****' + config.mid.substring(config.mid.length - 4) : '',
        website: config.website,
        industryType: config.industryType,
        callbackUrl: config.callbackUrl
      }
    };
  },

  savePaymentConfig(configData) {
    if (configData.staging !== undefined) {
      ConfigService.set('paytm_staging', String(configData.staging));
    }
    if (configData.mid) {
      ConfigService.set('paytm_mid', configData.mid);
    }
    if (configData.merchantKey) {
      ConfigService.set('paytm_merchant_key', configData.merchantKey);
    }
    if (configData.website) {
      ConfigService.set('paytm_website', configData.website);
    }
    if (configData.industryType) {
      ConfigService.set('paytm_industry_type', configData.industryType);
    }
    if (configData.callbackUrl) {
      ConfigService.set('paytm_callback_url', configData.callbackUrl);
    }
    return { success: true, message: 'Payment configuration saved' };
  }
};
