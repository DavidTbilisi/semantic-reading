'use strict';

// Spawns `npx serve` on $PORT (default 3700), waits for it to respond, runs
// the given child script, then tears the server down. Used by `npm run demo`
// so callers don't have to start a dev server in another terminal.

const { spawn } = require('child_process');
const http      = require('http');

const PORT  = Number(process.env.PORT || 3700);
const child = process.argv[2];

if (!child) {
  console.error('usage: node scripts/with-server.js <script.js>');
  process.exit(2);
}

const server = spawn('npx', ['serve', '-p', String(PORT), '.'], {
  stdio: ['ignore', 'ignore', 'inherit'],
});

const cleanup = () => { try { server.kill(); } catch (_) {} };
process.on('exit',    cleanup);
process.on('SIGINT',  () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });

function probe() {
  return new Promise(resolve => {
    const req = http.get({ host: 'localhost', port: PORT, path: '/', timeout: 500 }, res => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(maxMs = 10_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`server did not come up on port ${PORT} within ${maxMs}ms`);
}

(async () => {
  try {
    await waitForServer();
    const proc = spawn(process.execPath, [child], { stdio: 'inherit', env: { ...process.env, PORT: String(PORT) } });
    proc.on('exit', code => process.exit(code || 0));
  } catch (err) {
    console.error(err.message);
    cleanup();
    process.exit(1);
  }
})();
