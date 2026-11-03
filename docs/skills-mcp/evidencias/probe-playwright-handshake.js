// Sonda MCP: handshake JSON-RPC por stdio contra un servidor local
const { spawn } = require('child_process');

const cmd = process.argv[2];
const args = process.argv.slice(3);

const child = spawn(cmd, args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
let buf = '';
const pending = new Map();
let id = 0;

function send(method, params) {
  const msg = { jsonrpc: '2.0', id: ++id, method, params: params || {} };
  child.stdin.write(JSON.stringify(msg) + '\n');
  return new Promise((resolve) => pending.set(msg.id, resolve));
}

child.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});
child.stderr.on('data', (d) => {
  const s = d.toString().trim();
  if (s && !s.includes('npm')) console.error('[stderr]', s.slice(0, 200));
});

(async () => {
  const t0 = Date.now();
  const init = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'probe', version: '1.0.0' },
  });
  const ms = Date.now() - t0;
  console.log('INIT_OK', JSON.stringify(init.result?.serverInfo || init.error));
  console.log('PROTOCOL', init.result?.protocolVersion);
  console.log('HANDSHAKE_MS', ms);

  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tools = await send('tools/list', {});
  const list = tools.result?.tools || [];
  console.log('TOOLS_COUNT', list.length);
  console.log('TOOLS', list.map((t) => t.name).join(', '));

  child.kill();
  process.exit(0);
})().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.error('TIMEOUT');
  child.kill();
  process.exit(2);
}, 90000);
