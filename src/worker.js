// Cloudflare Worker: serves the site and routes each room to its own Durable Object.
// The Durable Object only passes small signaling messages (WebRTC setup, chat, sync);
// video and audio go directly between the people in the room.
const MAX_PEERS = 8;
const COLORS = 8; // distinct name colors in chat

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/config') {
      const ice = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
      if (env.TURN_URL) ice.push({ urls: env.TURN_URL.split(','), username: env.TURN_USER, credential: env.TURN_PASS });
      return Response.json({ iceServers: ice }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
      const room = (url.searchParams.get('room') || '').slice(0, 64);
      if (!room) return new Response('Missing room', { status: 400 });
      return env.ROOM.get(env.ROOM.idFromName(room)).fetch(request);
    }

    let file = '/index.html';
    if (url.pathname === '/chat.js') file = '/chat.js';
    else if (url.pathname === '/watch' || url.pathname.startsWith('/w/')) file = '/watch.html';
    return env.ASSETS.fetch(new Request(new URL(file, url), { method: 'GET' }));
  },
};

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    // Keep-alive pings are answered without waking the object
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch() {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  // joined peers (sockets that sent "join")
  peers(except) {
    return this.ctx.getWebSockets().filter((w) => w !== except && w.deserializeAttachment());
  }
  push(ws, e, d) { try { ws.send(JSON.stringify({ e, d })); } catch {} }

  async webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment();

    if (m.t === 'join' && !me) {
      const others = this.peers(ws);
      if (others.length >= MAX_PEERS) { this.push(ws, 'full', {}); return ws.close(1000, 'full'); }
      const used = new Set(others.map((w) => w.deserializeAttachment().color));
      let color = 0; while (used.has(color)) color++;
      color %= COLORS;
      const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      const name = String(m.name || 'Guest').slice(0, 30);
      const state = Object.assign({}, m.state, { color });
      const list = others.map((w) => { const a = w.deserializeAttachment(); return { id: a.id, name: a.name, state: a.state }; });
      for (const w of others) this.push(w, 'joined', { id, name, state });
      ws.serializeAttachment({ id, name, color, state });
      let sync = null;
      const s = await this.ctx.storage.get('sync');
      if (s) sync = { load: s.load, st: s.st && { playing: s.st.playing, t: s.st.t + (s.st.playing ? (Date.now() - s.st.at) / 1000 : 0) } };
      return this.push(ws, 'welcome', { id, color, peers: list, sync });
    }
    if (!me) return;

    if (m.t === 'send') {
      const { to, type, data } = m;
      if (type === 'state') {
        me.state = Object.assign({}, data, { color: me.color });
        ws.serializeAttachment(me);
        for (const w of this.peers(ws)) this.push(w, 'state', { from: me.id, data: me.state });
      } else if (type === 'sync' && data) {
        const s = (await this.ctx.storage.get('sync')) || {};
        if (data.load) { s.load = data.load; s.st = { playing: false, t: 0, at: Date.now() }; }
        if (data.st) s.st = { playing: !!data.st.playing, t: +data.st.t || 0, at: Date.now() };
        await this.ctx.storage.put('sync', s);
        for (const w of this.peers(ws)) this.push(w, 'sync', { from: me.id, data });
      } else if (type === 'chat' && data && typeof data.text === 'string') {
        const text = data.text.slice(0, 500);
        if (to) { const t = this.peers(ws).find((w) => w.deserializeAttachment().id === to); if (t) this.push(t, 'chat', { from: me.id, data: { text, private: true } }); }
        else for (const w of this.peers(ws)) this.push(w, 'chat', { from: me.id, data: { text, private: false } });
      } else if ((type === 'sdp' || type === 'ice') && to) {
        const t = this.peers(ws).find((w) => w.deserializeAttachment().id === to);
        if (t) this.push(t, type, { from: me.id, data });
      } else if (type === 'leave') {
        ws.close(1000, 'leave');
        await this.gone(ws);
      }
    }
  }

  async gone(ws) {
    const me = ws.deserializeAttachment();
    if (!me) return;
    ws.serializeAttachment(null);
    const rest = this.peers(ws);
    for (const w of rest) this.push(w, 'left', { id: me.id });
    if (!rest.length) await this.ctx.storage.deleteAll();
  }
  async webSocketClose(ws) { await this.gone(ws); }
  async webSocketError(ws) { await this.gone(ws); }
}
