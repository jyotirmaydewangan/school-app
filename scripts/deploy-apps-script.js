const fs = require('fs');
const path = require('path');
const {
  ROOT_DIR,
  getTenantDir,
  replaceInFile,
  log,
  runCommand,
  getDefaults
} = require('./utils');

async function deployAppsScript(tenantName) {
  if (!tenantName) {
    log('Error: Tenant name is required', 'error');
    log('Usage: node deploy-apps-script.js <tenant-name>', 'info');
    process.exit(1);
  }

  const tenantDir = getTenantDir(tenantName);

  if (!fs.existsSync(tenantDir)) {
    log(`Error: Tenant "${tenantName}" not found at ${tenantDir}`, 'error');
    log('Run: node scripts/create-tenant.js <tenant-name> first', 'info');
    process.exit(1);
  }

  const scriptIdPath = path.join(tenantDir, 'apps-script', 'SCRIPT_ID.txt');
  const webAppUrlPath = path.join(tenantDir, 'apps-script', 'WEB_APP_URL.txt');

  if (!fs.existsSync(scriptIdPath)) {
    log('Error: SCRIPT_ID.txt not found', 'error');
    process.exit(1);
  }

  let scriptId = fs.readFileSync(scriptIdPath, 'utf8').trim();

  if (!scriptId || scriptId.startsWith('#')) {
    log('Error: Please add your Apps Script ID to apps-script/SCRIPT_ID.txt', 'error');
    log('  Get it from: https://script.google.com/home/users/YOUR_EMAIL/projects', 'info');
    process.exit(1);
  }

  const appsScriptDir = path.join(tenantDir, 'apps-script');
  const templateDir = path.join(ROOT_DIR, 'template', 'apps-script');

  log('Syncing template files to tenant folder...', 'info');
  const templateFiles = ['Code.gs', '01_SheetService.gs', '02_Utils.gs', '03_ConfigService.gs',
    '04_UserRepository.gs', '05_SessionRepository.gs', '06_RoleRepository.gs',
    '07_AuthHandler.gs', '08_RoleHandler.gs', '09_UserHandler.gs', 'config.gs', 'appsscript.json'];

  templateFiles.forEach(file => {
    const src = path.join(templateDir, file);
    const dest = path.join(appsScriptDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  });
  log('✓ Template files synced', 'success');

  // Run placeholder replacements on config files
  const defaults = require('./utils').getDefaults();
  const roles = require('./utils').getRoles();
  const rolesJson = JSON.stringify(roles);

  const replacements = {
    '{TENANT}': tenantName,
    '{APP_NAME}': defaults.appName || 'My School',
    '{ALLOW_REGISTRATION}': defaults.allowRegistration !== false ? 'true' : 'false',
    '{DEFAULT_ROLE}': defaults.defaultRole || 'student',
    '{SESSION_TIMEOUT}': String(defaults.sessionTimeoutMinutes || 30),
    '{ROLES_JSON}': rolesJson
  };

  replaceInFile(path.join(appsScriptDir, 'config.gs'), replacements);
  log('✓ Config placeholders replaced', 'success');

  const claspJsonPath = path.join(appsScriptDir, '.clasp.json');
  if (!fs.existsSync(claspJsonPath)) {
    log('Creating .clasp.json to link project...', 'info');
    fs.writeFileSync(claspJsonPath, JSON.stringify({
      scriptId: scriptId,
      rootDir: '.'
    }, null, 2));
  }

  log('Pushing local files to Apps Script...', 'info');
  const pushResult = runCommand('clasp push --force', appsScriptDir);

  if (!pushResult.success) {
    log(`Error pushing files: ${pushResult.error}`, 'error');
    log('Try running manually: cd tenants/' + tenantName + '/apps-script && clasp push', 'info');
    process.exit(1);
  }
  log('✓ Files pushed successfully', 'success');

  let webAppUrl = '';
  if (fs.existsSync(webAppUrlPath)) {
    webAppUrl = fs.readFileSync(webAppUrlPath, 'utf8').trim();
  }

  if (!webAppUrl || webAppUrl.startsWith('#')) {
    log(`\n⚠ Please deploy manually in browser:`, 'warn');
    log(`  1. Go to: https://script.google.com/home/projects/${scriptId}`, 'info');
    log('  2. Click Deploy > New deployment', 'info');
    log('  3. Select type: Web app', 'info');
    log('  4. Description: Production', 'info');
    log('  5. Execute as: Me', 'info');
    log('  6. Who has access: Anyone', 'info');
    log('  7. Click Deploy', 'info');
    log('  8. Copy the Web App URL', 'info');
    log(`  9. Save it to: ${webAppUrlPath}`, 'info');
    log('', 'info');
    log('Then run this script again to continue.', 'info');
    process.exit(0);
  }

  log(`\n✓ Files pushed to Apps Script!`, 'success');
  log(`  Web App URL: ${webAppUrl}`, 'info');

  log('\nInitializing Google Sheet...', 'info');
  const initUrl = `${webAppUrl}?action=init`;

  try {
    const response = await fetch(initUrl, {
      method: 'GET',
      redirect: 'follow'
    });
    const text = await response.text();

    try {
      const result = JSON.parse(text);
      if (result.success) {
        log('✓ Google Sheet initialized: config, users, sessions, roles', 'success');
      } else {
        log(`Sheet init response: ${JSON.stringify(result)}`, 'info');
      }
    } catch (e) {
      log('Sheet init response received (could not parse JSON)', 'info');
      log('Response content (first 200 chars):', 'info');
      log(text.substring(0, 200), 'info');
    }
  } catch (err) {
    log(`Note: Could not auto-init sheets: ${err.message}`, 'warn');
    log('You may need to visit the URL manually to initialize', 'info');
  }

  log(`\nNext steps:`, 'info');
  log(`  1. cd tenants/${tenantName}/worker && wrangler deploy`, 'info');
  log(`  2. node scripts/deploy-pages.js ${tenantName}`, 'info');

  return webAppUrl;
}

const tenantName = process.argv[2];
deployAppsScript(tenantName).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
