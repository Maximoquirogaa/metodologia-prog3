// Sonda MCP remota (Streamable HTTP) contra Context7
const url = 'https://mcp.context7.com/mcp';
const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

async function rpc(payload) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
  const text = await res.text();
  const ct = res.headers.get('content-type') || '';
  let json = null;
  if (ct.includes('text/event-stream')) {
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        try { json = JSON.parse(line.slice(5).trim()); } catch {}
      }
    }
  } else {
    try { json = JSON.parse(text); } catch {}
  }
  return { status: res.status, ct, json, raw: text.slice(0, 200) };
}

(async () => {
  const t0 = Date.now();
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '1' } } });
  console.log('HTTP_STATUS', init.status, '| CT:', init.ct);
  console.log('INIT_MS', Date.now() - t0);
  console.log('SERVER_INFO', JSON.stringify(init.json?.result?.serverInfo));
  console.log('PROTOCOL', init.json?.result?.protocolVersion);
  console.log('CAPABILITIES', JSON.stringify(init.json?.result?.capabilities));
  if (!init.json?.result) console.log('RAW', init.raw);

  const tools = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const list = tools.json?.result?.tools || [];
  console.log('TOOLS_COUNT', list.length);
  for (const t of list) {
    console.log('TOOL', t.name, '|', (t.description || '').slice(0, 110));
  }

  // ¿Funciona sin credenciales? Llamada real
  const t1 = Date.now();
  const call = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'resolve-library-id', arguments: { libraryName: 'FastAPI', query: 'python web framework' } } });
  console.log('CALL_MS', Date.now() - t1, '| STATUS', call.status);
  const txt = call.json?.result?.content?.map((c) => c.text).join(' ') || JSON.stringify(call.json?.error);
  console.log('CALL_RESULT', txt.slice(0, 220));
})();
