const fs = require('fs');
const path = require('path');
const {
  ROOT_DIR,
  TEMPLATE_DIR,
  getTenantDir,
  getKVConfig,
  log,
  runCommand,
  copyFile
} = require('./utils');

function syncWorkerFiles(tenantDir) {
  const templateWorkerDir = path.join(TEMPLATE_DIR, 'worker');
  const tenantWorkerDir = path.join(tenantDir, 'worker');
  
  const filesToSync = [
    'src/index.js',
    'src/cache/KVCacheHandler.js',
    'src/cache/CacheHandler.js',
    'src/cache/CacheConfig.js',
    'src/routes/RouteConfig.js',
    'src/middleware/AuthMiddleware.js',
    'src/middleware/CorsMiddleware.js',
    'src/utils/ResponseHandler.js'
  ];

  log('Syncing worker template files...', 'info');
  
  filesToSync.forEach(file => {
    const src = path.join(templateWorkerDir, file);
    const dest = path.join(tenantWorkerDir, file);
    if (fs.existsSync(src)) {
      copyFile(src, dest);
    }
  });
  
  log('✓ Worker files synced', 'success');
}

function updateWranglerConfig(tenantDir, tenantName) {
  const tomlPath = path.join(tenantDir, 'worker', 'wrangler.toml');
  let tomlContent = fs.readFileSync(tomlPath, 'utf8');
  const kvConfig = getKVConfig();
  let updated = false;

  if (!tomlContent.includes('[[kv_namespaces]]')) {
    const kvBlock = `
[[kv_namespaces]]
binding = "${kvConfig.binding || 'DATA_CACHE'}"
id = "${kvConfig.namespaceId || ''}"
preview_id = ""

`;
    tomlContent = tomlContent.replace(
      'compatibility_date = ',
      kvBlock + 'compatibility_date = '
    );
    updated = true;
  }

  if (!tomlContent.includes('ENABLE_KV_CACHE')) {
    tomlContent = tomlContent.replace(
      'ENABLE_RATE_LIMIT = false',
      'ENABLE_RATE_LIMIT = false\nENABLE_KV_CACHE = true'
    );
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(tomlPath, tomlContent);
    log('✓ wrangler.toml updated with KV config', 'success');
  }
}

function deployWorker(tenantName, args = []) {
  if (!tenantName) {
    log('Error: Tenant name is required', 'error');
    log('Usage: node deploy-worker.js <tenant-name> [wrangler-args]', 'info');
    process.exit(1);
  }

  const tenantDir = getTenantDir(tenantName);
  
  if (!fs.existsSync(tenantDir)) {
    log(`Error: Tenant "${tenantName}" not found at ${tenantDir}`, 'error');
    log('Run: node scripts/create-tenant.js <tenant-name> first', 'info');
    process.exit(1);
  }

  syncWorkerFiles(tenantDir);
  updateWranglerConfig(tenantDir, tenantName);

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

  const tomlPath = path.join(tenantDir, 'worker', 'wrangler.toml');
  let tomlContent = fs.readFileSync(tomlPath, 'utf8');
  
  if (!tomlContent.includes('SCRIPT_URL = "')) {
    tomlContent = tomlContent.replace(
      '[vars]',
      '[vars]\nSCRIPT_URL = "' + webAppUrl + '"'
    );
    fs.writeFileSync(tomlPath, tomlContent);
  } else {
    tomlContent = tomlContent.replace(/SCRIPT_URL = "[^"]*"/, `SCRIPT_URL = "${webAppUrl}"`);
    fs.writeFileSync(tomlPath, tomlContent);
  }

  log(`Deploying Worker for tenant: ${tenantName}`, 'info');

  const workerDir = path.join(tenantDir, 'worker');
  const wranglerArgs = args.length > 0 ? args.join(' ') : 'deploy';
  
  const command = 'wrangler ' + wranglerArgs;
  log(`  Running: ${command}`, 'info');

  const result = runCommand(command, workerDir);
  
  if (!result.success) {
    log(`Error deploying worker: ${result.error}`, 'error');
    process.exit(1);
  }

  const output = result.output;
  
  const urlMatch = output.match(/https:\/\/[a-zA-Z0-9_.-]+\.workers\.dev/);
  
  let workerUrl = '';
  if (urlMatch) {
    workerUrl = urlMatch[0];
  } else {
    log('Could not find worker URL in output', 'warn');
    log('You may need to get the URL from Cloudflare dashboard', 'info');
  }

  if (workerUrl) {
    const configJsPath = path.join(tenantDir, 'public', 'js', 'config.js');
    const configContent = fs.readFileSync(configJsPath, 'utf8');
    
    const newConfig = configContent.replace(
      /API_URL: "([^"]*)"/,
      `API_URL: "${workerUrl}"`
    );
    
    fs.writeFileSync(configJsPath, newConfig);

    log(`\n✓ Worker deployed!`, 'success');
    log(`  URL: ${workerUrl}`, 'info');
    log(`\n✓ Updated public/js/config.js with API_URL`, 'success');
    log(`\nNext step:`, 'info');
    log(`  1. cd tenants/${tenantName}/public && wrangler pages deploy public`, 'info');
  } else {
    log(`\n✓ Worker deployed! (URL not found in output)`, 'success');
    log(`  Please copy your worker URL and update public/js/config.js manually:`, 'info');
    log(`  API_URL: "https://your-worker-url.workers.dev"`, 'info');
  }

  return workerUrl;
}

const tenantName = process.argv[2];
const args = process.argv.slice(3);
deployWorker(tenantName, args);
