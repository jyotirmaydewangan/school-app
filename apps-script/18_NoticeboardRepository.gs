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
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const index = data.findIndex(row => row[0] === id);
    
    if (index === -1) throw new Error('Notice not found');
    
    const rowNum = index + 1;
    let imageUrl = data[index][3]; // keep old by default

    if (noticeData.image_base64) {
      imageUrl = noticeData.image_base64;
    } else if (noticeData.remove_image) {
      imageUrl = '';
    }

    const updatedRecord = [
      id,
      noticeData.title || data[index][1],
      noticeData.content || data[index][2],
      imageUrl,
      data[index][4], // created_by
      data[index][5], // created_at
      noticeData.status || data[index][6]
    ];

    sheet.getRange(rowNum, 1, 1, headers.length).setValues([updatedRecord]);
    CacheService.getScriptCache().remove(this.DB_NAME);
    
    return {
      id: updatedRecord[0],
      title: updatedRecord[1],
      content: updatedRecord[2],
      image_url: updatedRecord[3],
      created_by: updatedRecord[4],
      created_at: updatedRecord[5],
      status: updatedRecord[6]
    };
  }

  static delete(id) {
    const sheet = SheetService.getSheet(SHEET_NAMES.NOTICEBOARD);
    const data = sheet.getDataRange().getValues();
    const index = data.findIndex(row => row[0] === id);
    
    if (index === -1) throw new Error('Notice not found');
    
    
    sheet.deleteRow(index + 1);
    CacheService.getScriptCache().remove(this.DB_NAME);
    
    return { success: true, id };
  }
}
