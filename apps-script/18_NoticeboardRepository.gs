class NoticeboardRepository {
  static get DB_NAME() {
    return 'NOTICES_DB';
  }


  static findAll() {
    const cache = CacheService.getScriptCache();
    const cached = cache.get(this.DB_NAME);
    if (cached) return JSON.parse(cached);

    const sheet = SheetService.getSheet(SHEET_NAMES.NOTICEBOARD);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // ['id', 'title', 'content', 'image_url', 'created_by', 'created_at', 'status']
    const notices = data.slice(1).map(row => ({
      id: row[0],
      title: row[1],
      content: row[2],
      image_url: row[3],
      created_by: row[4],
      created_at: row[5],
      status: row[6]
    })).filter(n => n.id);

    cache.put(this.DB_NAME, JSON.stringify(notices), 300);
    return notices;
  }

  static create(noticeData, userInfo) {
    const sheet = SheetService.getSheet(SHEET_NAMES.NOTICEBOARD);
    const id = Utilities.getUuid();
    const createdAt = new Date().toISOString();
    let imageUrl = null;

    if (noticeData.image_base64) {
      imageUrl = noticeData.image_base64;
    }

    const newRecord = [
      id,
      noticeData.title,
      noticeData.content,
      imageUrl || '',
      userInfo.name,
      createdAt,
      noticeData.status || 'published'
    ];

    sheet.appendRow(newRecord);
    CacheService.getScriptCache().remove(this.DB_NAME);
    
    return {
      id,
      title: noticeData.title,
      content: noticeData.content,
      image_url: imageUrl,
      created_by: userInfo.name,
      created_at: createdAt,
      status: noticeData.status || 'published'
    };
  }

  static update(id, noticeData) {
    const sheet = SheetService.getSheet(SHEET_NAMES.NOTICEBOARD);
    const range = sheet.getDataRange();
    const data = range.getValues();
    const headers = data[0];
    const index = data.findIndex(row => String(row[0]) === String(id));
    
    if (index === -1) throw new Error('Notice not found');
    
    const rowNum = index + 1;
    const row = data[index];
    
    // Map data by header to avoid index mistakes
    const statusIdx = headers.indexOf('status');
    const titleIdx = headers.indexOf('title');
    const contentIdx = headers.indexOf('content');
    const imageIdx = headers.indexOf('image_url');
    const updatedIdx = headers.indexOf('updated_at'); // If it exists
    
    if (noticeData.title !== undefined) row[titleIdx] = noticeData.title;
    if (noticeData.content !== undefined) row[contentIdx] = noticeData.content;
    if (noticeData.status !== undefined) row[statusIdx] = noticeData.status;
    
    if (noticeData.image_base64) {
      row[imageIdx] = noticeData.image_base64;
    } else if (noticeData.remove_image) {
      row[imageIdx] = '';
    }
    
    if (updatedIdx !== -1) row[updatedIdx] = new Date().toISOString();

    sheet.getRange(rowNum, 1, 1, headers.length).setValues([row]);
    CacheService.getScriptCache().remove(this.DB_NAME);
    
    // Convert row back to object for response
    const result = {};
    headers.forEach((h, i) => result[h] = row[i]);
    return result;
  }

  static delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.NOTICEBOARD);
    const data = sheet.getDataRange().getValues();
    const index = data.findIndex(row => String(row[0]) === String(id));
    
    if (index === -1) throw new Error('Notice not found');
    
    sheet.deleteRow(index + 1);
    CacheService.getScriptCache().remove(this.DB_NAME);
    
    return { success: true, id };
  }
}
