'use strict';

// Spawns an isolated Obsidian instance with CDP enabled, waits for a target,
// runs the given child script (which receives PORT + VAULT_PATH via env),
// then tears Obsidian down. Designed not to interfere with the user's
// concurrently-running Obsidian session — uses its own --user-data-dir.
//
// Usage:
//   node scripts/plugin-demo/with-obsidian.js scripts/plugin-demo/generate-demo.js

const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const http = require('http');

const OBSIDIAN  = '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
const USER_DATA = process.env.OBSIDIAN_USER_DATA || '/tmp/sr-obsidian-demo-userdata';
const VAULT     = process.env.OBSIDIAN_VAULT     || '/tmp/sr-obsidian-demo-vault';
const PORT      = Number(process.env.CDP_PORT    || 9333);

const child = process.argv[2];
if (!child) {
  console.error('usage: with-obsidian.js <child-script.js>');
  process.exit(2);
}

function probeCdp() {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/json', timeout: 800 }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end',  () => {
        try {
          const targets = JSON.parse(body);
          // We want at least one "page" target whose URL is something other
          // than the starter (vault chooser). The vault is auto-opened via
          // obsidian.json, so the page URL becomes app://obsidian.md/index.html.
          const ready = Array.isArray(targets)
            && targets.some(t => t.type === 'page' && t.url && !t.url.endsWith('/starter.html'));
          resolve(ready);
        } catch (_) { resolve(false); }
      });
    });
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForReady(maxMs = 30_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await probeCdp()) return;
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error(`Obsidian CDP did not reach a non-starter page within ${maxMs}ms`);
}

function writeUserData(vault) {
  // obsidian.json lives DIRECTLY inside the user-data-dir. (When you don't
  // pass --user-data-dir, Obsidian defaults to ~/Library/Application Support/obsidian,
  // and that's where its obsidian.json sits — the `obsidian` segment is the
  // user-data-dir itself, not a subdirectory inside it.)
  fs.mkdirSync(USER_DATA, { recursive: true });
  fs.writeFileSync(path.join(USER_DATA, 'obsidian.json'), JSON.stringify({
    vaults: {
      sr_demo_vault: { path: vault, ts: Date.now(), open: true },
    },
  }));
}

function seedVault() {
  const seedScript = path.join(__dirname, 'seed-vault.js');
  const result = require('child_process').spawnSync(
    process.execPath, [seedScript, VAULT], { stdio: 'inherit' }
  );
  if (result.status !== 0) throw new Error('seed-vault.js failed');
}

let obsidian;
function cleanup() {
  if (obsidian && !obsidian.killed) {
    try { obsidian.kill('SIGTERM'); } catch (_) {}
  }
}
process.on('exit',    cleanup);
process.on('SIGINT',  () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

(async () => {
  // Make sure no stale isolated instance is still around from a prior run.
  // We match on --user-data-dir to avoid touching the user's real Obsidian.
  try {
    const out = require('child_process').execSync(
      `pgrep -fl ${USER_DATA.replace(/[\\\/]/g, '.')} || true`
    ).toString().trim();
    if (out) console.warn('warning: existing isolated Obsidian process(es) detected — they may interfere');
  } catch (_) {}

  seedVault();
  writeUserData(VAULT);

  console.log('launching Obsidian (isolated, CDP', PORT + ')...');
  obsidian = spawn(OBSIDIAN, [
    `--user-data-dir=${USER_DATA}`,
    `--remote-debugging-port=${PORT}`,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  obsidian.stdout.on('data', () => {}); // quiet
  obsidian.stderr.on('data', () => {});

  try {
    await waitForReady();
    console.log('Obsidian ready, running', path.basename(child));
    const result = await new Promise(resolve => {
      const c = spawn(process.execPath, [child], {
        stdio: 'inherit',
        env: { ...process.env, CDP_PORT: String(PORT), VAULT_PATH: VAULT },
      });
      c.on('exit', code => resolve(code || 0));
    });
    process.exit(result);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
