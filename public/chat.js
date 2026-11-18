// Chat shared by the screen-sharing room and the watch-together room.
// Uses globals from the page: $, me, myId, peers, send, toast.
(function () {
  const PAL = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac'];

  const css = `
  #chat { position:fixed; right:10px; bottom:78px; width:min(340px,calc(100vw - 20px)); height:min(480px,calc(100dvh - 150px)); z-index:30; display:none; flex-direction:column; background:#181b22; border:1px solid #2a2f3a; border-radius:14px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,.5); }
  #chat.open { display:flex; }
  #chTabs { display:flex; gap:4px; padding:6px; overflow-x:auto; border-bottom:1px solid #2a2f3a; flex:none; }
  #chTabs button { background:#262b36; border:0; border-radius:8px; padding:6px 10px; cursor:pointer; white-space:nowrap; font-size:13px; display:flex; gap:6px; align-items:center; color:#e8eaf0; }
  #chTabs button.act { background:#3b4256; outline:1px solid #5b8cff; }
  #chTabs .x { opacity:.6; padding:0 2px; }
  #chTabs .dot { background:#e5484d; color:#fff; border-radius:9px; padding:0 6px; font-size:11px; }
  #chLog { flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px; font-size:14px; min-height:0; }
  #chLog > :first-child { margin-top:auto; }
  #chLog .m { word-break:break-word; }
  #chLog .m b { margin-right:6px; }
  #chLog .sys { color:#8b93a5; font-size:13px; text-align:center; }
  #chForm { display:flex; gap:6px; padding:8px; border-top:1px solid #2a2f3a; flex:none; }
  #chForm input { flex:1; min-width:0; background:#0f1115; border:1px solid #2a2f3a; border-radius:10px; padding:10px; color:#e8eaf0; font:inherit; font-size:16px; }
  #chForm button { background:#5b8cff; border:0; border-radius:10px; padding:0 14px; cursor:pointer; color:#fff; font-weight:600; }
  .tile { -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; }
  #bChat { position:relative; }
  #bChat .bdg { position:absolute; top:-6px; right:-6px; background:#e5484d; color:#fff; border-radius:10px; padding:0 6px; font-size:12px; display:none; }
  .tile .chip.n { border-left:4px solid var(--pc, #8b93a5); }
  @media (max-height:500px) and (orientation:landscape) { #chat { top:8px; bottom:8px; height:auto; left:auto; right:calc(76px + env(safe-area-inset-right)); width:min(340px,55vw); } }
  @media (max-width:720px) { #chat { left:6px; right:6px; width:auto; bottom:74px; height:min(70dvh,calc(100dvh - 140px)); } }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const panel = document.createElement('div'); panel.id = 'chat';
  panel.innerHTML = '<div id="chTabs"></div><div id="chLog"></div><form id="chForm"><input type="text" id="chIn" maxlength="500" placeholder="Message everyone" autocomplete="off"><button>Send</button></form>';
  document.body.appendChild(panel);

  const btn = document.createElement('button');
  btn.className = 'c'; btn.id = 'bChat'; btn.innerHTML = '💬 <span class="lbl">Chat</span><span class="bdg"></span>';
  const leave = document.querySelector('#bLeave');
  leave.parentNode.insertBefore(btn, leave);

  const colors = new Map(), names = new Map();
  const conv = new Map([['all', { msgs: [], unread: 0 }]]); // 'all' or a peer id
  let active = 'all', isOpen = false;

  const colorOf = (id) => {
    const i = id === myId ? me.color : (peers.get(id) && peers.get(id).state ? peers.get(id).state.color : undefined);
    if (i !== undefined) colors.set(id, PAL[i % PAL.length]);
    return colors.get(id) || '#8b93a5';
  };
  const nameOf = (id) => {
    const n = id === myId ? me.name : peers.get(id) ? peers.get(id).name : names.get(id);
    if (n) names.set(id, n);
    return n || 'Guest';
  };
  const getConv = (k) => { if (!conv.has(k)) conv.set(k, { msgs: [], unread: 0 }); return conv.get(k); };

  function render() {
    // tabs
    const tabs = $('#chTabs'); tabs.innerHTML = '';
    for (const [k, c] of conv) {
      if (c.hidden) continue;
      const b = document.createElement('button');
      if (k === active) b.classList.add('act');
      const label = document.createElement('span');
      label.textContent = k === 'all' ? '👥 Everyone' : '🔒 ' + nameOf(k);
      if (k !== 'all') label.style.color = colorOf(k);
      b.appendChild(label);
      if (c.unread && k !== active) { const d = document.createElement('span'); d.className = 'dot'; d.textContent = c.unread; b.appendChild(d); }
      if (k !== 'all') { const x = document.createElement('span'); x.className = 'x'; x.textContent = '×'; x.onclick = (e) => { e.stopPropagation(); c.hidden = true; if (active === k) active = 'all'; render(); }; b.appendChild(x); }
      b.onclick = () => { active = k; getConv(k).unread = 0; render(); $('#chIn').focus(); };
      tabs.appendChild(b);
    }
    // messages
    const log = $('#chLog'); log.innerHTML = '';
    const c = getConv(active);
    if (!c.msgs.length) { const s = document.createElement('div'); s.className = 'sys'; s.textContent = active === 'all' ? 'Messages here go to everyone in the room. Right-click a person to chat privately.' : 'Private chat with ' + nameOf(active) + '. Only you two see this.'; log.appendChild(s); }
    for (const m of c.msgs) {
      const d = document.createElement('div'); d.className = 'm';
      const n = document.createElement('b'); n.textContent = nameOf(m.from) + (m.from === myId ? ' (you)' : ''); n.style.color = colorOf(m.from);
      d.appendChild(n); d.appendChild(document.createTextNode(m.text));
      log.appendChild(d);
    }
    log.scrollTop = log.scrollHeight;
    // input
    const gone = active !== 'all' && !peers.has(active);
    const inp = $('#chIn'); inp.disabled = gone;
    inp.placeholder = gone ? nameOf(active) + ' left' : active === 'all' ? 'Message everyone' : 'Private message to ' + nameOf(active);
    // badge
    let total = 0; for (const [k, v] of conv) if (!(isOpen && k === active)) total += v.unread;
    const bdg = btn.querySelector('.bdg'); bdg.textContent = total; bdg.style.display = total ? '' : 'none';
  }

  function setOpen(v) {
    isOpen = v; panel.classList.toggle('open', v);
    if (v) { getConv(active).unread = 0; render(); $('#chIn').focus(); } else render();
  }
  btn.onclick = () => setOpen(!isOpen);

  function openPrivate(id) {
    if (!id || id === myId || !peers.has(id)) return;
    getConv(id).hidden = false;
    active = id; setOpen(true);
  }
  // Right-click (or long-press on phones) a person's tile -> private chat
  document.addEventListener('contextmenu', (e) => {
    const t = e.target.closest && e.target.closest('.tile');
    if (t && t.dataset.id && t.dataset.id !== 'me') { e.preventDefault(); openPrivate(t.dataset.id); }
  });

  // Long-press a tile on a phone -> private chat (right-click still works on computers)
  let lp = null;
  document.addEventListener('touchstart', (e) => {
    const t = e.target.closest && e.target.closest('.tile');
    clearTimeout(lp);
    if (t && t.dataset.id && t.dataset.id !== 'me') lp = setTimeout(() => { if (navigator.vibrate) navigator.vibrate(30); openPrivate(t.dataset.id); }, 500);
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach((n) => document.addEventListener(n, () => clearTimeout(lp), { passive: true }));

  // Phone keyboard: keep the whole chat inside the visible area above the keyboard
  function fit() {
    const vv = window.visualViewport;
    if (!vv || (window.innerWidth > 720 && window.innerHeight > 500)) { panel.style.top = panel.style.bottom = panel.style.height = ''; return; }
    const kb = window.innerHeight - (vv.offsetTop + vv.height);
    if (kb > 100) { panel.style.top = 'auto'; panel.style.bottom = (kb + 8) + 'px'; panel.style.height = Math.min(420, vv.height - 16) + 'px'; }
    else { panel.style.top = panel.style.bottom = panel.style.height = ''; }
    const log = $('#chLog'); log.scrollTop = log.scrollHeight;
  }
  if (window.visualViewport) { visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit); }

  $('#chForm').onsubmit = (e) => {
    e.preventDefault();
    const inp = $('#chIn'), text = inp.value.trim(); if (!text || inp.disabled) return;
    inp.value = '';
    send(active === 'all' ? null : active, 'chat', { text });
    getConv(active).msgs.push({ from: myId, text });
    render();
  };

  // incoming message (called from the page's event handler)
  window.chatIn = (d) => {
    const priv = !!(d.data && d.data.private);
    const key = priv ? d.from : 'all';
    const c = getConv(key); c.hidden = false;
    c.msgs.push({ from: d.from, text: String(d.data.text) });
    if (!(isOpen && active === key)) {
      c.unread++;
      toast((priv ? '🔒 ' : '💬 ') + nameOf(d.from) + ': ' + String(d.data.text).slice(0, 80), 3000);
    }
    render();
  };

  // colored names on the video tiles + keep the chat in sync with who is in the room
  setInterval(() => {
    document.querySelectorAll('.tile').forEach((t) => { const id = t.dataset.id === 'me' ? myId : t.dataset.id; if (id) t.style.setProperty('--pc', colorOf(id)); });
    document.querySelectorAll('.tile .chip.n').forEach((c) => { const id = c.closest('.tile').dataset.id; c.style.color = colorOf(id === 'me' ? myId : id); });
    const sig = [...peers.keys()].join(',');
    if (isOpen && sig !== setInterval.sig) { setInterval.sig = sig; render(); }
  }, 1500);
})();
