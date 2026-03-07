const fs = require('fs');
const path = require('path');
const {
  ROOT_DIR,
  TEMPLATE_DIR,
  TENANTS_DIR,
  getTenantDir,
  replaceInFile,
  log,
  getDefaults,
  getKVConfig,
  getProjectPrefix,
  getRoles,
  getPermissionRequirements
} = require('./utils');

function syncTemplateFiles(tenantName, options = {}) {
  const { dryRun = false, verbose = false } = options;

  if (!tenantName) {
    log('Error: Tenant name is required', 'error');
    log('Usage: node scripts/sync-template.js <tenant-name> [--dry-run]', 'info');
    process.exit(1);
  }

  const tenantDir = getTenantDir(tenantName);

  if (!fs.existsSync(tenantDir)) {
    log(`Error: Tenant "${tenantName}" not found at ${tenantDir}`, 'error');
    log('Run: node scripts/create-tenant.js <tenant-name> first', 'info');
    process.exit(1);
  }

  const defaults = getDefaults();
  const kvConfig = getKVConfig();

  let existingWorkerUrl = '';
  const workerTomlPath = path.join(tenantDir, 'worker', 'wrangler.toml');
  if (fs.existsSync(workerTomlPath)) {
    const workerTomlContent = fs.readFileSync(workerTomlPath, 'utf8');
    const urlMatch = workerTomlContent.match(/SCRIPT_URL\s*=\s*"([^"]+)"/);
    if (urlMatch) {
      existingWorkerUrl = urlMatch[1];
    }
  }

  const cacheConfig = defaults.cache || {};

  const replacements = {
    '{TENANT}': tenantName,
    '{PROJECT_PREFIX}': getProjectPrefix(),
    '{APP_NAME}': defaults.appName || 'My School',
    '{DEFAULT_ROLE}': defaults.defaultRole || 'student',
    '{SESSION_TIMEOUT}': String(defaults.sessionTimeoutMinutes || 60),
    '{JWT_SECRET}': require('crypto').randomBytes(32).toString('hex'),
    '{RATE_LIMIT}': String(defaults.rateLimitPerMinute || 60),
    '{CACHE_TTL}': String(defaults.cacheTtlSeconds || 2592000),
    '{CACHE_TTL_USERS}': String(cacheConfig.users || 2592000),
    '{CACHE_TTL_CONFIG}': String(cacheConfig.config || 2592000),
    '{CACHE_TTL_ROLES}': String(cacheConfig.roles || 2592000),
    '{CACHE_TTL_ATTENDANCE}': String(cacheConfig.attendance || 604800),
    '{CACHE_TTL_NOTICEBOARD}': String(cacheConfig.noticeboard || 604800),
    '{CACHE_TTL_TIMETABLE}': String(cacheConfig.timetable || 2592000),
    '{CACHE_TTL_MARKS}': String(cacheConfig.marks || 604800),
    '{CACHE_TTL_VERIFY}': String(cacheConfig.verify || 900),
    '{ALLOW_REGISTRATION}': String(defaults.allowRegistration !== false),
    '{PRIMARY_COLOR}': defaults.theme?.primaryColor || '#2563eb',
    '{SECONDARY_COLOR}': defaults.theme?.secondaryColor || '#1e40af',
    '{CONTACT_EMAIL}': defaults.contactEmail || '',
    '{LOGO_URL}': defaults.logoUrl || '',
    '{FAVICON_URL}': defaults.faviconUrl || '',
    '{SHOW_POWERED_BY}': String(defaults.showPoweredBy || false),
    '{STORAGE_PREFIX}': defaults.storagePrefix || getProjectPrefix() + '_app',
    '{KV_NAMESPACE_ID}': kvConfig.namespaceId || '',
    '{KV_BINDING}': kvConfig.binding || 'DATA_CACHE',
    '{ROLES_JSON}': JSON.stringify(getRoles() || {}),
    '{PERMISSION_REQUIREMENTS_JSON}': JSON.stringify(getPermissionRequirements() || {}),
    '{API_URL_PLACEHOLDER}': existingWorkerUrl ? existingWorkerUrl.replace('/exec', '') : ''
  };

  const syncResults = [];

  function syncDir(srcDir, destDir, files, description) {
    if (verbose) log(`Syncing ${description}...`, 'info');

    if (!fs.existsSync(srcDir)) {
      if (verbose) log(`  Source dir not found: ${srcDir}`, 'warn');
      return;
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    files.forEach(file => {
      const src = path.join(srcDir, file);
      const dest = path.join(destDir, file);

      if (fs.existsSync(src)) {
        if (dryRun) {
          syncResults.push({ action: 'copy', from: src, to: dest });
          if (verbose) log(`  [DRY-RUN] Would copy: ${file}`, 'info');
        } else {
          fs.copyFileSync(src, dest);
          syncResults.push({ action: 'copy', from: src, to: dest });
          if (verbose) log(`  ✓ Copied: ${file}`, 'success');
        }
      }
    });
  }

  function syncDirRecursive(srcDir, destDir, description, ignorePatterns = []) {
    if (verbose) log(`Syncing ${description}...`, 'info');

    if (!fs.existsSync(srcDir)) {
      if (verbose) log(`  Source dir not found: ${srcDir}`, 'warn');
      return;
    }

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    function shouldIgnore(filePath) {
      const fileName = path.basename(filePath);
      return ignorePatterns.some(pattern => {
        if (pattern.startsWith('*.')) {
          const ext = pattern.slice(1);
          return fileName.endsWith(ext);
        }
        return fileName === pattern || filePath.includes(pattern);
      });
    }

    function copyRecursive(src, dest) {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(child => {
          copyRecursive(path.join(src, child), path.join(dest, child));
        });
      } else {
        if (!shouldIgnore(src)) {
          fs.copyFileSync(src, dest);
          syncResults.push({ action: 'copy', from: src, to: dest });
          if (verbose) log(`  ✓ Copied: ${path.relative(srcDir, src)}`, 'success');
        } else {
          if (verbose) log(`  - Ignored: ${path.relative(srcDir, src)}`, 'info');
        }
      }
    }

    fs.readdirSync(srcDir).forEach(child => {
      copyRecursive(path.join(srcDir, child), path.join(destDir, child));
    });
  }

  function replaceInConfigFiles() {
    // First sync and replace, then restore API_URL from environment variable
    const envApiUrl = process.env.API_URL || '';

    const configFiles = [
      { file: 'apps-script/config.gs', replacements },
      { file: 'public/js/config.js', replacements },
      { file: 'public/js/auth.js', replacements },
      {
        file: 'public/wrangler.toml', replacements: {
          '{PROJECT_PREFIX}': defaults.project?.namePrefix || 'school',
          '{TENANT}': tenantName
        }
      },
      { file: 'worker/wrangler.toml', replacements },
      // Worker source files that carry injected placeholders
      { file: 'worker/src/cache/CacheConfig.js', replacements },
      { file: 'worker/src/middleware/PermissionMiddleware.js', replacements }
    ];

    configFiles.forEach(({ file, replacements: repl }) => {
      const filePath = path.join(tenantDir, file);
      if (fs.existsSync(filePath)) {
        if (dryRun) {
          syncResults.push({ action: 'replace', file });
          if (verbose) log(`  [DRY-RUN] Would replace placeholders: ${file}`, 'info');
        } else {
          replaceInFile(filePath, repl);
          syncResults.push({ action: 'replace', file });
          if (verbose) log(`  ✓ Replaced placeholders: ${file}`, 'success');
        }
      }
    });

    // After all replacements, if API_URL was set via env or worker deploy, preserve it
    const configPath = path.join(tenantDir, 'public', 'js', 'config.js');
    if (fs.existsSync(configPath) && envApiUrl) {
      let content = fs.readFileSync(configPath, 'utf8');
      content = content.replace(/"\{API_URL_PLACEHOLDER\}"/, `"${envApiUrl}"`);
      fs.writeFileSync(configPath, content);
      if (verbose) log(`  ✓ Restored API_URL from env`, 'success');
    }
  }

  log(`\n=== Syncing template to tenant: ${tenantName} ===`, 'info');
  if (dryRun) log('⚠ DRY RUN - No files will be modified\n', 'warn');

  // Backup config.js before any syncing
  const configBackupPath = path.join(tenantDir, 'public', 'js', 'config.js.backup');
  const configPath = path.join(tenantDir, 'public', 'js', 'config.js');
  let backedUpApiUrl = '';
  let backedUpRoles = '';
  if (fs.existsSync(configPath)) {
    const backupContent = fs.readFileSync(configPath, 'utf8');
    const apiMatch = backupContent.match(/API_URL:\s*"([^"]+)"/);
    backedUpApiUrl = apiMatch ? apiMatch[1] : '';
    const rolesMatch = backupContent.match(/ROLES:\s*({[\s\S]*?}|\[[\s\S]*?\])/);
    backedUpRoles = rolesMatch ? rolesMatch[1] : '';
    fs.writeFileSync(configBackupPath, backupContent);
  }

  // Sync Apps Script files
  syncDir(
    path.join(ROOT_DIR, 'apps-script'),
    path.join(tenantDir, 'apps-script'),
    ['Code.gs', '01_SheetService.gs', '02_Utils.gs', '03_ConfigService.gs',
      '04_UserRepository.gs', '05_SessionRepository.gs', '06_RoleRepository.gs',
      '07_AuthHandler.gs', '08_RoleHandler.gs', '09_UserHandler.gs',
      'config.gs', 'appsscript.json'],
    'Apps Script files'
  );

  // Sync Worker files recursively (ignore package files, copy wrangler.toml)
  syncDirRecursive(
    path.join(ROOT_DIR, 'worker'),
    path.join(tenantDir, 'worker'),
    'Worker files',
    ['package.json', 'package-lock.json', '.wrangler']
  );

  // Sync Public files recursively (ignore config files)
  syncDirRecursive(
    path.join(ROOT_DIR, 'public'),
    path.join(tenantDir, 'public'),
    'Public files',
    ['wrangler.toml']
  );

  // Replace placeholders in config files
  replaceInConfigFiles();

  // Merge: restore old API_URL and ROLES if valid
  if ((backedUpApiUrl && backedUpApiUrl.startsWith('http')) || backedUpRoles) {
    const newConfigPath = path.join(tenantDir, 'public', 'js', 'config.js');
    if (fs.existsSync(newConfigPath)) {
      let content = fs.readFileSync(newConfigPath, 'utf8');
      // Replace API_URL
      if (backedUpApiUrl && backedUpApiUrl.startsWith('http')) {
        content = content.replace(/API_URL:\s*"[^"]*"/, `API_URL: "${backedUpApiUrl}"`);
      }
      // Replace ROLES
      if (backedUpRoles) {
        content = content.replace(/ROLES:\s*({[\s\S]*?}|\[[\s\S]*?\])/, `ROLES: ${backedUpRoles}`);
      }
      fs.writeFileSync(newConfigPath, content);
      if (verbose) log(`  ✓ Merged: restored API_URL and/or ROLES from backup`, 'success');
    }
  }

  // Clean up backup
  if (fs.existsSync(configBackupPath)) {
    fs.unlinkSync(configBackupPath);
  }

  log(`\n✓ Sync complete!`, 'success');
  if (dryRun) {
    log(`  ${syncResults.length} operations would be performed`, 'info');
  } else {
    log(`  ${syncResults.filter(r => r.action === 'copy').length} files copied`, 'info');
    log(`  ${syncResults.filter(r => r.action === 'replace').length} config files updated`, 'info');
  }

  log(`\nNext steps:`, 'info');
  log(`  1. node scripts/deploy-apps-script.js ${tenantName}`, 'info');
  log(`  2. node scripts/deploy-worker.js ${tenantName}`, 'info');
  log(`  3. node scripts/deploy-pages.js ${tenantName}`, 'info');

  return syncResults;
}

const tenantName = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

syncTemplateFiles(tenantName, { dryRun, verbose });
