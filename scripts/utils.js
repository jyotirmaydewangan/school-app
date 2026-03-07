const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT_DIR = path.resolve(__dirname, '..');
const TEMPLATE_DIR = ROOT_DIR;
const TENANTS_DIR = path.join(ROOT_DIR, 'tenants');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.yaml');

let _config = null;

function loadConfig() {
  if (_config === null) {
    if (fs.existsSync(CONFIG_FILE)) {
      const fileContents = fs.readFileSync(CONFIG_FILE, 'utf8');
      _config = yaml.load(fileContents);
    } else {
      _config = {};
    }
  }
  return _config;
}

function getConfig() {
  return loadConfig();
}

function getProjectPrefix() {
  const config = loadConfig();
  return config?.project?.namePrefix || 'school';
}

function getDefaults() {
  const config = loadConfig();
  return config?.defaults || {};
}

function getCacheConfig() {
  const config = loadConfig();
  return config?.cache || {};
}

function getRoles() {
  const config = loadConfig();
  return config?.roles || {};
}

function getRolesJson() {
  const roles = getRoles();
  return JSON.stringify(roles);
}

function getPermissionRequirements() {
  const config = loadConfig();
  return config?.permissions?.actionRequirements || {};
}

function getPermissionRequirementsJson() {
  const reqs = getPermissionRequirements();
  return JSON.stringify(reqs);
}

function getKVConfig() {
  const config = loadConfig();
  return config?.kv || {};
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

function copyFile(src, dest) {
  const content = fs.readFileSync(src, 'utf8');
  writeFile(dest, content);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

function replacePlaceholders(content, replacements) {
  let result = content;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.split(key).join(value);
  }
  return result;
}

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  const oldContent = content;
  content = replacePlaceholders(content, replacements);

  if (content !== oldContent) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTenantDir(tenant) {
  return path.join(TENANTS_DIR, tenant);
}

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type] || ''}${message}${colors.reset}`);
}

function runCommand(command, cwd) {
  const { execSync } = require('child_process');
  try {
    const output = execSync(command, {
      cwd: cwd || ROOT_DIR,
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, CI: 'true' }
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout };
  }
}

module.exports = {
  ROOT_DIR,
  TEMPLATE_DIR,
  TENANTS_DIR,
  CONFIG_FILE,
  readJsonFile,
  writeJsonFile,
  readFile,
  writeFile,
  copyFile,
  copyDir,
  replacePlaceholders,
  replaceInFile,
  ensureDir,
  getTenantDir,
  log,
  runCommand,
  getConfig,
  getProjectPrefix,
  getDefaults,
  getCacheConfig,
  getRoles,
  getRolesJson,
  getKVConfig,
  getPermissionRequirements,
  getPermissionRequirementsJson
};
