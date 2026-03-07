const fs = require('fs');
const path = require('path');
const {
  getTenantDir,
  TEMPLATE_DIR,
  replaceInFile,
  log,
  runCommand,
  getDefaults,
  getRoles
} = require('./utils');

function deployPages(tenantName, args = []) {
  if (!tenantName) {
    log('Error: Tenant name is required', 'error');
    log('Usage: node deploy-pages.js <tenant-name> [wrangler-args]', 'info');
    process.exit(1);
  }

  const tenantDir = getTenantDir(tenantName);
  const templatePublicDir = path.join(TEMPLATE_DIR, 'public');
  const configJsPath = path.join(tenantDir, 'public', 'js', 'config.js');
  const backupPath = path.join(tenantDir, 'public', 'js', 'config.js.backup');

  if (!fs.existsSync(tenantDir)) {
    log(`Error: Tenant "${tenantName}" not found at ${tenantDir}`, 'error');
    log('Run: node scripts/create-tenant.js <tenant-name> first', 'info');
    process.exit(1);
  }

  // Step 1: Backup current config.js if exists
  let backedUpApiUrl = '';
  let backedUpRoles = '';
  if (fs.existsSync(configJsPath)) {
    const content = fs.readFileSync(configJsPath, 'utf8');
    fs.writeFileSync(backupPath, content);
    const apiMatch = content.match(/API_URL:\s*"([^"]+)"/);
    backedUpApiUrl = apiMatch ? apiMatch[1] : '';
    // Don't backup empty ROLES - use defaults from config.yaml
  }

  log('Syncing template public files...', 'info');

  // Step 2: Sync files (skip config.js - handle specially)
  const filesToSync = ['index.html', 'app.html', 'password-hash-tool.html'];
  const dirsToSync = ['js'];

  filesToSync.forEach(file => {
    const src = path.join(templatePublicDir, file);
    const dest = path.join(tenantDir, 'public', file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  });

  function syncDirRecursive(srcDir, destDir, skipFiles = []) {
    if (!fs.existsSync(srcDir)) return;
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.readdirSync(srcDir).forEach(f => {
      const srcPath = path.join(srcDir, f);
      const destPath = path.join(destDir, f);
      
      if (skipFiles.includes(f)) return;
      
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        syncDirRecursive(srcPath, destPath, []);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  dirsToSync.forEach(dir => {
    const srcDir = path.join(templatePublicDir, dir);
    const destDir = path.join(tenantDir, 'public', dir);
    if (fs.existsSync(srcDir) && fs.existsSync(destDir)) {
      syncDirRecursive(srcDir, destDir, ['config.js']);
    }
  });
  log('✓ Public template files synced', 'success');

  // Step 3: Replace placeholders in config.js
  const defaults = getDefaults();
  const roles = getRoles();
  const replacements = {
    '{TENANT}': tenantName,
    '{PROJECT_PREFIX}': defaults.project?.namePrefix || 'school',
    '{APP_NAME}': defaults.defaults?.appName || 'My School',
    '{DEFAULT_ROLE}': defaults.defaults?.defaultRole || 'student',
    '{SESSION_TIMEOUT}': String(defaults.defaults?.sessionTimeoutMinutes || 30),
    '{RATE_LIMIT}': String(defaults.defaults?.rateLimitPerMinute || 60),
    '{CACHE_TTL}': String(defaults.defaults?.cacheTtlSeconds || 300),
    '{ALLOW_REGISTRATION}': String(defaults.defaults?.allowRegistration !== false),
    '{PRIMARY_COLOR}': defaults.defaults?.theme?.primaryColor || '#2563eb',
    '{SECONDARY_COLOR}': defaults.defaults?.theme?.secondaryColor || '#1e40af',
    '{CONTACT_EMAIL}': defaults.defaults?.contactEmail || '',
    '{LOGO_URL}': defaults.defaults?.logoUrl || '',
    '{FAVICON_URL}': defaults.defaults?.faviconUrl || '',
    '{SHOW_POWERED_BY}': String(defaults.defaults?.showPoweredBy || false),
    '{VERIFY_CACHE_DURATION}': String(defaults.defaults?.auth?.verifyCacheDurationMs || 300000),
    '{TOKEN_THRESHOLD}': String(defaults.defaults?.auth?.tokenExpiringThresholdMs || 60000),
    '{ROLES_JSON}': JSON.stringify(Object.fromEntries(Object.entries(roles).map(([name, data]) => [
      name,
      {
        role_name: name,
        permissions: data.permissions || [],
        pages: data.pages || [],
        is_active: data.isActive !== false
      }
    ]))),
    '{API_URL_PLACEHOLDER}': backedUpApiUrl || ''
  };

  // Now replace placeholders in the synced config.js
  // Note: {ROLES_JSON} will be replaced with actual roles from config.yaml
  replaceInFile(configJsPath, replacements);
  replaceInFile(path.join(tenantDir, 'public', 'js', 'auth.js'), replacements);
  log('✓ Config placeholders replaced', 'success');

  // Only merge API_URL from backup (don't touch ROLES - keep from template/config.yaml)
  if (backedUpApiUrl) {
    let content = fs.readFileSync(configJsPath, 'utf8');
    content = content.replace(/API_URL:\s*"[^"]*"/, `API_URL: "${backedUpApiUrl}"`);
    fs.writeFileSync(configJsPath, content);
    log('✓ Merged API_URL from backup', 'success');
  }

  // Clean up backup
  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }

  // Check API_URL - warn if not set
  const finalContent = fs.readFileSync(configJsPath, 'utf8');
  const apiMatch = finalContent.match(/API_URL:\s*"([^"]+)"/);
  const apiUrl = apiMatch ? apiMatch[1] : '';

  if (!apiUrl || apiUrl.startsWith('{')) {
    log('⚠ Warning: API_URL not set properly in config.js', 'warn');
    log('  Please edit public/js/config.js and set API_URL to your Worker URL', 'warn');
  }

  log(`Deploying Pages for tenant: ${tenantName}`, 'info');
  log(`  API URL: ${apiUrl || '(not set)'}`, 'info');

  // Get project name from wrangler.toml
  const wranglerTomlPath = path.join(tenantDir, 'public', 'wrangler.toml');
  let projectName = tenantName;
  if (fs.existsSync(wranglerTomlPath)) {
    const tomlContent = fs.readFileSync(wranglerTomlPath, 'utf8');
    const nameMatch = tomlContent.match(/name\s*=\s*"([^"]+)"/);
    if (nameMatch) {
      projectName = nameMatch[1];
    }
  }

  log(`Creating Pages project if needed...`, 'info');
  runCommand(`wrangler pages project create ${projectName} --production-branch main`, path.join(tenantDir, 'public'));

  const wranglerArgs = args.length > 0 ? args.join(' ') : `pages deploy . --project-name ${projectName}`;
  const command = 'wrangler ' + wranglerArgs;
  log(`  Running: ${command}`, 'info');

  const result = runCommand(command, path.join(tenantDir, 'public'));

  if (!result.success) {
    log(`Error deploying pages: ${result.error}`, 'error');
    process.exit(1);
  }

  const output = result.output;
  const urlMatch = output.match(/https:\/\/[a-zA-Z0-9_.-]+\.pages\.dev/);

  if (urlMatch) {
    const pagesUrl = urlMatch[0];
    log(`\n✓ Pages deployed!`, 'success');
    log(`  URL: ${pagesUrl}`, 'info');
    log(`\n✓ Deployment complete!`, 'success');
    log(`  Tenant: ${tenantName}`, 'info');
    log(`  Apps Script: Already deployed`, 'info');
    log(`  Worker: Already deployed`, 'info');
    log(`  Pages: ${pagesUrl}`, 'info');
  } else {
    log(`\n✓ Pages deployed! (URL not found in output)`, 'success');
    log('You may need to get the URL from Cloudflare dashboard', 'info');
  }
}

const tenantName = process.argv[2];
const args = process.argv.slice(3);
deployPages(tenantName, args);
