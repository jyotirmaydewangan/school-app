const fs = require('fs');
const path = require('path');
const {
  getTenantDir,
  log
} = require('./utils');

async function setupSheets(tenantName) {
  if (!tenantName) {
    log('Error: Tenant name is required', 'error');
    log('Usage: node scripts/init-sheets.js <tenant-name>', 'info');
    process.exit(1);
  }

  const tenantDir = getTenantDir(tenantName);
  
  if (!fs.existsSync(tenantDir)) {
    log(`Error: Tenant "${tenantName}" not found`, 'error');
    process.exit(1);
  }

  const webAppUrlPath = path.join(tenantDir, 'apps-script', 'WEB_APP_URL.txt');
  
  if (!fs.existsSync(webAppUrlPath)) {
    log('Error: WEB_APP_URL.txt not found', 'error');
    log('Run: node scripts/deploy-apps-script.js first', 'info');
    process.exit(1);
  }

  let webAppUrl = fs.readFileSync(webAppUrlPath, 'utf8').trim();
  
  if (!webAppUrl || webAppUrl.startsWith('#')) {
    log('Error: Please add your Web App URL to apps-script/WEB_APP_URL.txt', 'error');
    log('  After deploying as Web App, copy the URL and save it here', 'info');
    process.exit(1);
  }

  const initUrl = `${webAppUrl}?action=init`;
  
  log('Initializing Google Sheet...', 'info');
  log(`URL: ${initUrl}`, 'info');
  log('', 'info');
  
  try {
    const response = await fetch(initUrl, { 
      method: 'GET',
      redirect: 'follow'
    });
    const text = await response.text();
    
    try {
      const result = JSON.parse(text);
      if (result.success) {
        log('✓ Google Sheet initialized with all required tabs:', 'success');
        log('  - config, users, sessions, roles', 'info');
        log('  - students, parent_students, subjects', 'info');
        log('  - exams, marks, timetable, syllabus', 'info');
        log('  - resources, class_index, classes, schools, sections', 'info');
      } else {
        log(`Sheet initialization response: ${JSON.stringify(result)}`, 'info');
      }
    } catch (e) {
      log('Response received (could not parse JSON):', 'info');
      log(text.substring(0, 500), 'info');
    }
  } catch (err) {
    log(`Error calling init: ${err.message}`, 'error');
    log('Please open the URL in your browser manually:', 'info');
    log(initUrl, 'info');
  }
}

const tenantName = process.argv[2];
setupSheets(tenantName).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
