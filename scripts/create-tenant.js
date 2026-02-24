const {
  ROOT_DIR,
  TEMPLATE_DIR,
  TENANTS_DIR,
  copyDir,
  replaceInFile,
  ensureDir,
  getTenantDir,
  log,
  getProjectPrefix,
  getDefaults,
  getRolesJson,
  getKVConfig
} = require('./utils');

function createTenant(tenantName) {
  if (!tenantName) {
    log('Error: Tenant name is required', 'error');
    log('Usage: node create-tenant.js <tenant-name>', 'info');
    process.exit(1);
  }

  const tenantDir = getTenantDir(tenantName);
  
  if (require('fs').existsSync(tenantDir)) {
    log(`Error: Tenant "${tenantName}" already exists at ${tenantDir}`, 'error');
    process.exit(1);
  }

  log(`Creating tenant: ${tenantName}`, 'info');

  ensureDir(TENANTS_DIR);
  ensureDir(tenantDir);

  if (!require('fs').existsSync(TEMPLATE_DIR)) {
    log(`Error: Template directory not found: ${TEMPLATE_DIR}`, 'error');
    log('Please create the template folder first', 'info');
    process.exit(1);
  }

  const defaults = getDefaults();
  const projectPrefix = getProjectPrefix();
  const rolesJson = getRolesJson();
  const storagePrefix = defaults.storagePrefix || getProjectPrefix() + '_app';
  const kvConfig = getKVConfig();
  
  const replacements = {
    '{TENANT}': tenantName,
    '{PROJECT_PREFIX}': projectPrefix,
    '{APP_NAME}': defaults.appName || 'My School',
    '{DEFAULT_ROLE}': defaults.defaultRole || 'student',
    '{SESSION_TIMEOUT}': defaults.sessionTimeoutMinutes || 30,
    '{RATE_LIMIT}': defaults.rateLimitPerMinute || 60,
    '{CACHE_TTL}': defaults.cacheTtlSeconds || 300,
    '{ALLOW_REGISTRATION}': String(defaults.allowRegistration !== false),
    '{PRIMARY_COLOR}': defaults.theme?.primaryColor || '#2563eb',
    '{SECONDARY_COLOR}': defaults.theme?.secondaryColor || '#1e40af',
    '{CONTACT_EMAIL}': defaults.contactEmail || '',
    '{LOGO_URL}': defaults.logoUrl || '',
    '{FAVICON_URL}': defaults.faviconUrl || '',
    '{SHOW_POWERED_BY}': String(defaults.showPoweredBy || false),
    '{ROLES_JSON}': rolesJson,
    '{STORAGE_PREFIX}': storagePrefix,
    '{KV_NAMESPACE_ID}': kvConfig.namespaceId || '',
    '{KV_BINDING}': kvConfig.binding || 'DATA_CACHE'
  };

  copyDir(TEMPLATE_DIR, tenantDir);

  const tomlPath = require('path').join(tenantDir, 'worker', 'wrangler.toml');
  replaceInFile(tomlPath, replacements);

  const publicTomlPath = require('path').join(tenantDir, 'public', 'wrangler.toml');
  replaceInFile(publicTomlPath, replacements);

  const configJsPath = require('path').join(tenantDir, 'public', 'js', 'config.js');
  replaceInFile(configJsPath, replacements);

  const authJsPath = require('path').join(tenantDir, 'public', 'js', 'auth.js');
  replaceInFile(authJsPath, replacements);

  const configGsPath = require('path').join(tenantDir, 'apps-script', 'config.gs');
  replaceInFile(configGsPath, replacements);

  const scriptIdPath = require('path').join(tenantDir, 'apps-script', 'SCRIPT_ID.txt');
  require('fs').writeFileSync(scriptIdPath, '# Add your Apps Script ID here\n');

  const webAppUrlPath = require('path').join(tenantDir, 'apps-script', 'WEB_APP_URL.txt');
  require('fs').writeFileSync(webAppUrlPath, '# Add your Web App URL here after first deployment\n# Example: https://script.google.com/macros/s/ABC123XYZ/exec\n');

  log(`\n✓ Tenant "${tenantName}" created successfully!`, 'success');
  log(`  Location: ${tenantDir}`, 'info');
  log(`\nNext steps:`, 'info');
  log(`  1. Create Google Sheet + Apps Script in browser`, 'info');
  log(`  2. Update apps-script/SCRIPT_ID.txt with your Script ID`, 'info');
  log(`  3. Run: node scripts/deploy-apps-script.js ${tenantName}`, 'info');
}

const tenantName = process.argv[2];
createTenant(tenantName);
