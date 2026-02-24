const fs = require('fs');
const path = require('path');
const {
  getTenantDir,
  log,
  runCommand
} = require('./utils');

function deployPages(tenantName, args = []) {
  if (!tenantName) {
    log('Error: Tenant name is required', 'error');
    log('Usage: node deploy-pages.js <tenant-name> [wrangler-args]', 'info');
    process.exit(1);
  }

  const tenantDir = getTenantDir(tenantName);
  
  if (!fs.existsSync(tenantDir)) {
    log(`Error: Tenant "${tenantName}" not found at ${tenantDir}`, 'error');
    log('Run: node scripts/create-tenant.js <tenant-name> first', 'info');
    process.exit(1);
  }

  const configJsPath = path.join(tenantDir, 'public', 'js', 'config.js');
  const configContent = fs.readFileSync(configJsPath, 'utf8');
  
  const apiUrlMatch = configContent.match(/API_URL: "([^"]*)"/);
  const apiUrl = apiUrlMatch?.[1];
  
  if (!apiUrl) {
    log('Error: API_URL is not set in public/js/config.js', 'error');
    log('Run: node scripts/deploy-worker.js ' + tenantName + ' first', 'info');
    process.exit(1);
  }

  log(`Deploying Pages for tenant: ${tenantName}`, 'info');
  log(`  API URL: ${apiUrl}`, 'info');

  const publicDir = path.join(tenantDir, 'public');
  
  const configTomlPath = path.join(publicDir, 'wrangler.toml');
  let projectName = tenantName;
  if (fs.existsSync(configTomlPath)) {
    const tomlContent = fs.readFileSync(configTomlPath, 'utf8');
    const nameMatch = tomlContent.match(/name\s*=\s*"([^"]+)"/);
    if (nameMatch) {
      projectName = nameMatch[1];
    }
  }

  log(`Creating Pages project if needed...`, 'info');
  runCommand(`wrangler pages project create ${projectName} --production-branch main`, publicDir);
  
  const wranglerArgs = args.length > 0 ? args.join(' ') : `pages deploy . --project-name ${projectName}`;
  
  const command = 'wrangler ' + wranglerArgs;
  log(`  Running: ${command}`, 'info');

  const result = runCommand(command, publicDir);
  
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
