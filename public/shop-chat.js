/* ShopChat — shared per-shop live chat for Yently folder apps.
   ONE file, loaded with <script src="/shop-chat.js"> from any folder
   app (diner, pos, barbers, dealer, employee, bodyshop, houses,
   doctor, holiday, rentals, laundry, kids-*). Plain vanilla JS, no
   build step, no imports, no framework. Inline styles only — folder
   apps have their own style.css and this file must not depend on it.

   This is NOT Yently's own chat (src/components/ChatWidget.jsx,
   src/lib/chat.js, site_settings.chat_enabled). Shop chat is scoped
   to one shop: one ownerType + ownerKey (the shop slug), its own
   tables/RPCs, its own visitor id. The admin flips it ON per shop
   (shop_chat_switches); when OFF the bubble renders nothing.

   RPC shape copied exactly from public/diner/app.js: fetch POST to
   SUPABASE_URL + '/rest/v1/rpc/' + name, headers apikey +
   Authorization Bearer anon key. Notification shape copied from the
   folder apps' notifyEmail: fetch POST to SUPABASE_URL +
   '/functions/v1/send-notification' with {to, subject, table,
   record}; the edge function accepts `to` (src/lib/notify.js) and
   falls back to the owner's inbox when it is absent. A failed email
   never blocks the chat.

   Layout uses logical properties (inset-inline-end, margin-inline-*)
   so the bubble mirrors correctly on RTL pages (kids-arabic etc.). */
(function () {
  'use strict';

  /* Public by design: the same publishable key the main Yently site
     ships in its own pages (same value as public/diner/app.js). */
  var SUPABASE_URL = 'https://deykvlxikzwwrygmkdly.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_e2uwGgFB0SvVQS-TZahArQ_mjypz9Vr';

  var VISITOR_KEY = 'yently-shop-chat-visitor-id';
  var POLL_MS = 8000;
  var ACCENT = '#f5c542';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }

  /* Same shape as the rpc() helper in public/diner/app.js. */
  function rpc(name, body) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!res.ok) throw new Error((j && j.message) || 'request failed');
        return j;
      });
    });
  }

  /* Best-effort owner email. Never throws, never blocks the chat. */
  function notifyOwner(ownerEmail, shopName, visitorName, message) {
    if (!ownerEmail) return;
    try {
      fetch(SUPABASE_URL + '/functions/v1/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY },
        body: JSON.stringify({
          to: ownerEmail,
          subject: 'New chat message on ' + shopName,
          table: 'shop_chat_messages',
          record: { shop: shopName, visitor_name: visitorName || '', message: message }
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function getVisitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) {
      return 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    }
  }
  function storeGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function storeDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function convKey(t, k) { return 'yently-shop-chat-conv-' + t + '-' + k; }
  function nameKey(t, k) { return 'yently-shop-chat-name-' + t + '-' + k; }

  /* start_shop_chat returns a conversation id or null; tolerate an
     object shape ({id} / {conversation_id}) as well as a bare id. */
  function convId(v) {
    if (v == null) return null;
    if (typeof v === 'object') return v.id || v.conversation_id || v.conversationId || null;
    return v;
  }
  function normMessages(rows) {
    if (!rows || !Array.isArray(rows)) return [];
    return rows.map(function (m) {
      return {
        id: m.id,
        body: m.body || m.message || '',
        sender: String(m.sender || m.role || m.from || '').toLowerCase(),
        at: m.created_at || m.createdAt || ''
      };
    });
  }
  function isMine(m) { return m.sender === 'visitor' || m.sender === 'customer'; }
  function fmtTime(at) {
    if (!at) return '';
    try { return new Date(at).toLocaleString(); } catch (e) { return String(at); }
  }

  /* ---------- Visitor bubble ---------- */
  function mountBubble(el, opts) {
    opts = opts || {};
    var ownerType = opts.ownerType || '';
    var ownerKey = opts.ownerKey || '';
    var shopName = opts.shopName || 'this shop';
    var ownerEmail = (opts.ownerEmail || '').trim();
    if (!el || !ownerType || !ownerKey) return;

    /* First check the switch; OFF renders nothing. A failed check
       also renders nothing (fail closed, no dead bubble). */
    rpc('shop_chat_enabled', { p_owner_type: ownerType, p_owner_key: ownerKey }).then(function (ok) {
      if (ok !== true) return;
      /* The switch row can carry the shop's notification email
         (typed by the admin when the switch is created, from the
         Live Chat order). It is only the fallback: the app's own
         owner email, when the app passes one, wins. */
      if (ownerEmail) { renderBubble(); return; }
      rpc('shop_chat_notify_email', { p_owner_type: ownerType, p_owner_key: ownerKey }).then(function (em) {
        if (typeof em === 'string' && em.trim()) ownerEmail = em.trim();
        renderBubble();
      }).catch(function () { renderBubble(); });
    }).catch(function () {});

    function renderBubble() {
      var visitorId = getVisitorId();
      var conversationId = convId(storeGet(convKey(ownerType, ownerKey))) || null;
      var visitorName = storeGet(nameKey(ownerType, ownerKey));
      var open = false;
      var timer = null;
      var messages = [];

      var fabStyle = 'position:fixed;bottom:16px;inset-inline-end:16px;z-index:9998;width:56px;height:56px;border-radius:50%;border:none;background:' + ACCENT + ';font-size:26px;line-height:1;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
      var panelStyle = 'position:fixed;bottom:84px;inset-inline-end:16px;z-index:9999;width:min(340px,calc(100vw - 32px));max-height:min(480px,calc(100vh - 110px));display:none;flex-direction:column;background:#fff;color:#222;border:1px solid #ddd;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.3);overflow:hidden;font-family:inherit;';
      var headStyle = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:' + ACCENT + ';font-weight:bold;';
      var msgsStyle = 'flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;min-height:120px;';
      var inputStyle = 'flex:1;padding:9px 10px;border:1px solid #ccc;border-radius:8px;font:inherit;';
      var sendStyle = 'padding:9px 14px;border:none;border-radius:8px;background:' + ACCENT + ';font-weight:bold;cursor:pointer;';

      /* Append into a wrapper instead of replacing el's contents:
         mountBubble must be safe to call with document.body (the
         original el.innerHTML = ... wiped the whole page). A
         previous bubble wrapper is removed first, so re-mounting
         never duplicates the IDs. */
      var oldWrap = el.querySelector('[data-shop-chat="bubble"]');
      if (oldWrap) oldWrap.remove();
      var wrap = document.createElement('div');
      wrap.setAttribute('data-shop-chat', 'bubble');
      wrap.innerHTML =
        '<button type="button" id="shop-chat-fab" style="' + fabStyle + '" aria-label="Chat with ' + esc(shopName) + '">💬</button>' +
        '<div id="shop-chat-panel" style="' + panelStyle + '" role="dialog" aria-label="Chat with ' + esc(shopName) + '">' +
          '<div style="' + headStyle + '"><span>💬 Chat with ' + esc(shopName) + '</span>' +
          '<button type="button" id="shop-chat-close" style="border:none;background:transparent;font-size:18px;cursor:pointer;line-height:1;" aria-label="Close chat">✕</button></div>' +
          '<div id="shop-chat-msgs" style="' + msgsStyle + '"></div>' +
          '<div id="shop-chat-name-row" style="padding:8px 12px 0;' + (visitorName || conversationId ? 'display:none;' : '') + '">' +
            '<input id="shop-chat-name" type="text" placeholder="Your name (optional)" value="' + esc(visitorName) + '" autocomplete="name" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;border-radius:8px;font:inherit;">' +
          '</div>' +
          '<form id="shop-chat-form" style="display:flex;gap:8px;padding:10px 12px;border-top:1px solid #eee;">' +
            '<input id="shop-chat-input" type="text" placeholder="Type your message..." autocomplete="off" style="' + inputStyle + '">' +
            '<button type="submit" style="' + sendStyle + '">Send</button>' +
          '</form>' +
          '<p id="shop-chat-status" style="margin:0;padding:0 12px 10px;color:#a00;font-size:13px;"></p>' +
        '</div>';
      el.appendChild(wrap);

      var panel = $('shop-chat-panel');
      var msgsEl = $('shop-chat-msgs');
      var statusEl = $('shop-chat-status');

      function renderMessages() {
        if (!messages.length) {
          msgsEl.innerHTML = '<p style="margin:0;color:#666;font-size:14px;">Say hello — the shop will reply here.</p>';
          return;
        }
        msgsEl.innerHTML = messages.map(function (m) {
          var mine = isMine(m);
          var bubble = 'max-width:85%;padding:8px 10px;border-radius:10px;overflow-wrap:anywhere;' +
            (mine ? 'margin-inline-start:auto;background:' + ACCENT + ';' : 'margin-inline-end:auto;background:#f0f0f0;');
          return '<div style="' + bubble + '" dir="auto"><div>' + esc(m.body) + '</div>' +
            (m.at ? '<div style="font-size:11px;color:#666;margin-top:4px;">' + esc(fmtTime(m.at)) + '</div>' : '') + '</div>';
        }).join('');
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
      function refresh() {
        if (!conversationId) return Promise.resolve();
        return rpc('get_shop_messages', { p_conversation_id: conversationId, p_visitor_id: visitorId })
          .then(function (rows) { messages = normMessages(rows); renderMessages(); })
          .catch(function () { /* keep the last good messages on a failed poll */ });
      }
      function startPoll() {
        stopPoll();
        timer = setInterval(function () { refresh(); }, POLL_MS);
      }
      function stopPoll() { if (timer) { clearInterval(timer); timer = null; } }
      function setOpen(v) {
        open = v;
        panel.style.display = v ? 'flex' : 'none';
        if (v) { renderMessages(); if (conversationId) refresh(); startPoll(); }
        else stopPoll();
      }

      $('shop-chat-fab').addEventListener('click', function () { setOpen(!open); });
      $('shop-chat-close').addEventListener('click', function () { setOpen(false); });

      $('shop-chat-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('shop-chat-input');
        var body = input.value.trim();
        if (!body) return;
        var nameInput = $('shop-chat-name');
        if (nameInput && nameInput.value.trim()) {
          visitorName = nameInput.value.trim();
          storeSet(nameKey(ownerType, ownerKey), visitorName);
        }
        statusEl.textContent = '';
        input.value = '';
        var retried = false;
        function sendOnce() {
          var need = !conversationId;
          var st = need
            ? rpc('start_shop_chat', { p_owner_type: ownerType, p_owner_key: ownerKey, p_visitor_id: visitorId, p_visitor_name: visitorName || '' })
                .then(function (id) {
                  conversationId = convId(id);
                  if (!conversationId) throw new Error('Could not start the chat.');
                  storeSet(convKey(ownerType, ownerKey), String(conversationId));
                  var nr = $('shop-chat-name-row');
                  if (nr) nr.style.display = 'none';
                })
            : Promise.resolve();
          return st.then(function () {
            return rpc('send_shop_message', { p_conversation_id: conversationId, p_visitor_id: visitorId, p_body: body });
          });
        }
        sendOnce().then(function () {
          /* Owner email is best-effort: it must never block the chat. */
          notifyOwner(ownerEmail, shopName, visitorName, body);
          return refresh();
        }).catch(function (err) {
          /* A stored conversation id can go stale (the chat was
             deleted, or the visitor's browser kept an old id): drop
             it, start a fresh conversation and try once more. */
          var gone = String((err && err.message) || '').toLowerCase().indexOf('not found') !== -1;
          if (gone && !retried) {
            retried = true;
            storeDel(convKey(ownerType, ownerKey));
            conversationId = null;
            var nr = $('shop-chat-name-row');
            if (nr) nr.style.display = '';
            return sendOnce().then(function () {
              notifyOwner(ownerEmail, shopName, visitorName, body);
              return refresh();
            }).catch(function (err2) {
              statusEl.textContent = 'Could not send: ' + err2.message + ' Please try again.';
              input.value = body;
            });
          }
          statusEl.textContent = 'Could not send: ' + err.message + ' Please try again.';
          input.value = body;
        });
      });

      renderMessages();
    }
  }

  /* ---------- Owner inbox ---------- */
  function mountInbox(el, opts) {
    opts = opts || {};
    var ownerType = opts.ownerType || '';
    var ownerKey = opts.ownerKey || '';
    var creds = opts.creds || {};
    if (!el || !ownerType || !ownerKey || !creds.u || !creds.p) return;

    var convs = [];
    var selectedId = null;
    var messages = [];
    var timer = null;
    var authFailed = false;

    /* Same wrapper rule as the bubble: never replace el's contents. */
    var oldInbox = el.querySelector('[data-shop-chat="inbox"]');
    if (oldInbox) oldInbox.remove();
    var inboxWrap = document.createElement('div');
    inboxWrap.setAttribute('data-shop-chat', 'inbox');
    inboxWrap.innerHTML =
      '<div id="shop-chat-inbox" style="font-family:inherit;">' +
        '<h3 style="margin:0 0 8px;">Chats</h3>' +
        '<div id="shop-chat-conv-list"><p style="color:#666;">Loading…</p></div>' +
        '<div id="shop-chat-thread" style="margin-top:12px;"></div>' +
      '</div>';
    el.appendChild(inboxWrap);

    function isAuthError(err) {
      var m = String((err && err.message) || err || '').toLowerCase();
      return m.indexOf('authoriz') !== -1 || m.indexOf('invalid') !== -1 || m.indexOf('sign in') !== -1;
    }
    function authHint() {
      return '<p style="color:#a00;">Could not open chats — sign in again from Setup.</p>';
    }
    function convClosed(c) { return c.status === 'closed' || c.is_closed === true; }
    function convName(c) { return c.visitor_name || c.name || c.visitor || 'Visitor'; }
    function convPreview(c) { return c.last_message || c.preview || c.last_body || c.body || ''; }
    function convTime(c) { return c.last_message_at || c.updated_at || c.created_at || ''; }

    function renderList() {
      var listEl = $('shop-chat-conv-list');
      if (!listEl) return;
      if (authFailed) { listEl.innerHTML = authHint(); return; }
      if (!convs.length) {
        listEl.innerHTML = '<p style="color:#666;">No chats yet.</p>';
        return;
      }
      listEl.innerHTML = convs.map(function (c) {
        var id = c.id || c.conversation_id;
        var sel = String(id) === String(selectedId);
        var row = 'display:block;width:100%;box-sizing:border-box;text-align:start;padding:10px 12px;margin-bottom:6px;border:1px solid ' + (sel ? ACCENT : '#ddd') + ';border-radius:8px;background:' + (sel ? '#fff8e1' : '#fff') + ';cursor:pointer;font:inherit;';
        return '<button type="button" data-conv="' + esc(id) + '" style="' + row + '">' +
          '<span style="display:flex;justify-content:space-between;gap:8px;"><b>' + esc(convName(c)) + '</b>' +
          '<span style="font-size:12px;color:' + (convClosed(c) ? '#666' : '#0a7d2c') + ';">' + (convClosed(c) ? 'Closed' : 'Open') + '</span></span>' +
          '<span style="display:block;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(convPreview(c)) + '</span>' +
          (convTime(c) ? '<span style="display:block;font-size:12px;color:#666;">' + esc(fmtTime(convTime(c))) + '</span>' : '') +
        '</button>';
      }).join('');
      var btns = listEl.querySelectorAll('[data-conv]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].addEventListener('click', function () { selectConv(this.getAttribute('data-conv')); });
      }
    }
    function renderThread() {
      var t = $('shop-chat-thread');
      if (!t) return;
      /* Keep a typed reply (and its focus) across re-renders: the
         poll rebuilds this form, and must never eat what the owner
         is typing or a Send click in progress. */
      var draftInput = $('shop-chat-reply');
      var draft = draftInput ? draftInput.value : '';
      var draftFocused = draftInput ? document.activeElement === draftInput : false;
      if (authFailed) { t.innerHTML = ''; return; }
      if (!selectedId) { t.innerHTML = ''; return; }
      var sel = null;
      convs.forEach(function (c) { if (String(c.id || c.conversation_id) === String(selectedId)) sel = c; });
      var html = '<h4 style="margin:0 0 8px;">' + esc(sel ? convName(sel) : 'Chat') + '</h4>';
      if (!messages.length) html += '<p style="color:#666;">No messages yet.</p>';
      else {
        html += messages.map(function (m) {
          var mine = !isMine(m); /* owner reply = "mine" here */
          var bubble = 'max-width:85%;padding:8px 10px;border-radius:10px;margin-bottom:8px;overflow-wrap:anywhere;' +
            (mine ? 'margin-inline-start:auto;background:' + ACCENT + ';' : 'margin-inline-end:auto;background:#f0f0f0;');
          return '<div style="' + bubble + '" dir="auto"><div>' + esc(m.body) + '</div>' +
            (m.at ? '<div style="font-size:11px;color:#666;margin-top:4px;">' + esc(fmtTime(m.at)) + '</div>' : '') + '</div>';
        }).join('');
      }
      html += '<form id="shop-chat-reply-form" style="display:flex;gap:8px;margin-top:10px;">' +
        '<input id="shop-chat-reply" type="text" placeholder="Type your reply..." autocomplete="off" style="flex:1;padding:9px 10px;border:1px solid #ccc;border-radius:8px;font:inherit;">' +
        '<button type="submit" style="padding:9px 14px;border:none;border-radius:8px;background:' + ACCENT + ';font-weight:bold;cursor:pointer;">Send</button>' +
      '</form><p id="shop-chat-reply-status" style="margin:8px 0 0;color:#a00;font-size:13px;"></p>';
      t.innerHTML = html;
      var restored = $('shop-chat-reply');
      if (restored && draft) { restored.value = draft; if (draftFocused) restored.focus(); }
      $('shop-chat-reply-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('shop-chat-reply');
        var body = input.value.trim();
        if (!body || !selectedId) return;
        input.value = '';
        rpc('send_shop_reply', { p_conversation_id: selectedId, p_u: creds.u, p_p: creds.p, p_body: body })
          .then(function () { return refreshThread(); })
          .then(function () { return loadConvs(true); })
          .catch(function (err) {
            if (isAuthError(err)) { authFailed = true; renderList(); renderThread(); return; }
            /* Fetch the elements fresh: a poll may have rebuilt the
               form since the submit, and the old ones are detached. */
            var curSt = $('shop-chat-reply-status');
            if (curSt) curSt.textContent = 'Could not send: ' + err.message;
            var curInput = $('shop-chat-reply');
            if (curInput) curInput.value = body;
          });
      });
    }
    function loadConvs(quiet) {
      return rpc('list_shop_conversations', { p_owner_type: ownerType, p_owner_key: ownerKey, p_u: creds.u, p_p: creds.p })
        .then(function (rows) {
          authFailed = false;
          convs = Array.isArray(rows) ? rows : [];
          renderList();
        })
        .catch(function (err) {
          if (isAuthError(err)) { authFailed = true; renderList(); renderThread(); return; }
          if (!quiet) {
            var listEl = $('shop-chat-conv-list');
            if (listEl) listEl.innerHTML = '<p style="color:#a00;">Could not load chats: ' + esc(err.message) + '</p>';
          }
        });
    }
    function refreshThread() {
      if (!selectedId) return Promise.resolve();
      return rpc('get_shop_conversation_messages', { p_conversation_id: selectedId, p_u: creds.u, p_p: creds.p })
        .then(function (rows) {
          var next = normMessages(rows);
          /* Re-render only when something actually arrived: the poll
             must not rebuild the reply form under the owner's fingers. */
          if (JSON.stringify(next) !== JSON.stringify(messages)) { messages = next; renderThread(); }
        })
        .catch(function (err) {
          if (isAuthError(err)) { authFailed = true; renderList(); renderThread(); }
          /* otherwise keep the last good thread on a failed poll */
        });
    }
    function selectConv(id) {
      selectedId = id;
      messages = [];
      renderList();
      renderThread();
      refreshThread();
    }

    loadConvs();
    timer = setInterval(function () {
      if (authFailed) return;
      loadConvs(true);
      refreshThread();
    }, POLL_MS);
    /* The folder app owns the tab lifecycle; expose a stop handle on
       the container so it can clear the poll when the tab closes. */
    el._shopChatStop = function () { if (timer) { clearInterval(timer); timer = null; } };
  }

  /* Public API — exactly the three methods the wiring builder uses. */
  function isEnabled(ownerType, ownerKey) {
    return rpc('shop_chat_enabled', { p_owner_type: ownerType, p_owner_key: ownerKey })
      .then(function (ok) { return ok === true; })
      .catch(function () { return false; });
  }

  window.ShopChat = {
    isEnabled: isEnabled,
    mountBubble: mountBubble,
    mountInbox: mountInbox
  };
})();
