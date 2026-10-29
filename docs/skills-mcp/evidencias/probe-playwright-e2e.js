// Prueba funcional real: navegar + snapshot + consola
const { spawn } = require('child_process');
const child = spawn('npx', ['-y', '@playwright/mcp@latest', '--headless', '--isolated', '--browser', 'chromium'], {
  shell: true,
  stdio: ['pipe', 'pipe', 'pipe'],
});
let buf = '';
const pending = new Map();
let id = 0;
function send(method, params) {
  const msg = { jsonrpc: '2.0', id: ++id, method, params: params || {} };
  child.stdin.write(JSON.stringify(msg) + '\n');
  return new Promise((res, rej) => {
    pending.set(msg.id, res);
    setTimeout(() => rej(new Error('timeout ' + method)), 60000);
  });
}
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const m = JSON.parse(line);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    } catch {}
  }
});
child.stderr.on('data', () => {});
(async () => {
  const init = await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '1' } });
  console.log('SERVER', init.result?.serverInfo?.name, init.result?.serverInfo?.version);
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const t0 = Date.now();
  const nav = await send('tools/call', { name: 'browser_navigate', arguments: { url: 'data:text/html,<title>MCP Test</title><h1 id=x>Hola desde Playwright MCP</h1><button>Click me</button>' } });
  console.log('NAV_MS', Date.now() - t0);
  const navText = nav.result?.content?.map((c) => c.text).join(' ').slice(0, 300);
  console.log('NAV_RESULT', nav.error ? 'ERROR ' + JSON.stringify(nav.error) : navText);

  const snap = await send('tools/call', { name: 'browser_snapshot', arguments: {} });
  const snapText = snap.result?.content?.map((c) => c.text).join(' ').slice(0, 400);
  console.log('SNAPSHOT', snap.error ? 'ERROR ' + JSON.stringify(snap.error) : snapText);

  const evalR = await send('tools/call', { name: 'browser_evaluate', arguments: { function: '() => document.title' } });
  console.log('EVAL', evalR.error ? 'ERROR ' + JSON.stringify(evalR.error) : evalR.result?.content?.map((c) => c.text).join(' ').slice(0, 200));

  child.kill();
  process.exit(0);
})().catch((e) => { console.error('FAIL', e.message); child.kill(); process.exit(1); });
