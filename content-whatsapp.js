// content-whatsapp.js
(() => {
  // ======== Estado: enabled + policy ========
  let enabled = true;      // controlado pelas opções
  let hasPolicy = false;   // sem policy => bloqueia tudo (quando enabled)
  let allowedExts = new Set(); // vazio até carregar policy

  // carrega enabled + policy
  chrome.storage.local.get(['enabled', 'policy']).then(({ enabled: en, policy }) => {
    if (en === false) enabled = false;
    const list = policy?.allowed?.extensions;
    if (Array.isArray(list) && list.length) {
      hasPolicy = true;
      allowedExts = new Set(list.map((s) => String(s).toLowerCase()));
    }
  });

  // observa mudanças em runtime
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (Object.prototype.hasOwnProperty.call(changes, 'enabled')) {
      enabled = changes.enabled.newValue !== false;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'policy')) {
      const p = changes.policy?.newValue;
      const list = p?.allowed?.extensions;
      if (Array.isArray(list) && list.length) {
        hasPolicy = true;
        allowedExts = new Set(list.map((s) => String(s).toLowerCase()));
      } else {
        hasPolicy = false;
        allowedExts = new Set();
      }
    }
  });

  // ======== Toast in-page ========
  function ensureToastInfra() {
    if (document.getElementById('wa-dl-guard-toast-style')) return;
    const st = document.createElement('style');
    st.id = 'wa-dl-guard-toast-style';
    st.textContent = `
      #wa-dl-guard-toast-host { position: fixed; right: 16px; top: 16px; z-index: 2147483647;
        display: flex; flex-direction: column; gap: 8px; pointer-events: none;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .wa-dl-guard-toast { background: rgba(230, 0, 0, 0.92); color: #fff; border-radius: 10px;
        padding: 10px 12px; min-width: 260px; max-width: 360px; box-shadow: 0 6px 18px rgba(0,0,0,.35);
        opacity: 0; transform: translateY(-8px); transition: opacity .16s ease, transform .16s ease; }
      .wa-dl-guard-toast.show { opacity: 1; transform: translateY(0); }
      .wa-dl-guard-toast .title { font-weight: 700; margin-bottom: 2px; }
      .wa-dl-guard-toast .msg { opacity: .9; font-size: 12px; }
    `;
    (document.head || document.documentElement).appendChild(st);
    const host = document.createElement('div');
    host.id = 'wa-dl-guard-toast-host';
    (document.documentElement || document.body || document.head).appendChild(host);
  }

  function showToast(title, msg) {
    try {
      ensureToastInfra();
      const host = document.getElementById('wa-dl-guard-toast-host');
      if (!host) return;
      const el = document.createElement('div');
      el.className = 'wa-dl-guard-toast';
      el.innerHTML = `<div class="title">🛡️ ${title}</div><div class="msg">${msg || ''}</div>`;
      host.appendChild(el);
      void el.offsetHeight;
      el.classList.add('show');
      setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 180); }, 2600);
    } catch {}
  }

  // ======== Helpers ========
  const isWhatsAppHost = (h) => /(^|\.)whatsapp\.(com|net)$/i.test(h) || /^wa\.me$/i.test(h);
  const isWAishUrl = (url) => {
    if (!url) return false;
    if (url.startsWith('blob:') || url.startsWith('data:')) return true;
    try { return isWhatsAppHost(new URL(url, location.href).hostname); } catch { return false; }
  };

  const extFromFilename = (name) => {
    if (!name) return '';
    const clean = name.split(/[?#]/)[0];
    const last = clean.split('/').pop() || '';
    const dot = last.lastIndexOf('.');
    if (dot <= 0) return '';
    return last.slice(dot + 1).toLowerCase();
  };
  const extFromUrl = (url) => { try { return extFromFilename(new URL(url, location.href).pathname); } catch { return ''; } };

  // sem policy => bloquear tudo; com policy => liberar só extensão permitida
  const shouldBlockByExt = (href, downloadAttr) => {
    if (!enabled) return false; // desativado → nunca bloquear
    if (!hasPolicy) return true;
    const ext = (downloadAttr && extFromFilename(downloadAttr)) || extFromUrl(href);
    if (!ext) return true;
    return !allowedExts.has(ext);
  };

  const BLOCK = (why, details) => {
    // se estiver desativado, não faz nada
    if (!enabled) return;
    showToast('Download bloqueado', details || 'Tipo não permitido pela política.');
    try { chrome.runtime?.sendMessage?.({ type: 'wa-blocked-notify', why }); } catch {}
  };

  // ======== Interceptores ========
  function onAnchorClick(e, anchor) {
    if (!enabled) return; // toggle OFF → passa tudo
    const href = anchor.getAttribute('href') || anchor.href || '';
    if (!isWAishUrl(href)) return;
    const dn = anchor.getAttribute('download') || anchor.download || '';
    if (shouldBlockByExt(href, dn)) {
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      const ext = (dn && extFromFilename(dn)) || extFromUrl(href) || '(desconhecido)';
      BLOCK('anchor', hasPolicy ? `Bloqueado: .${ext}` : 'Bloqueado: nenhuma policy carregada');
    }
  }

  // clique do usuário
  window.addEventListener('click', (e) => {
    if (!enabled) return;
    const a = e.target?.closest?.('a[href]');
    if (!a) return;
    onAnchorClick(e, a);
  }, true);

  // clique programático
  const _aClick = HTMLAnchorElement.prototype.click;
  Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
    configurable: true, writable: true,
    value: function(...args) {
      if (!enabled) return _aClick.apply(this, args);
      const href = this.getAttribute('href') || this.href || '';
      if (isWAishUrl(href)) {
        const dn = this.getAttribute('download') || this.download || '';
        if (shouldBlockByExt(href, dn)) {
          const ext = (dn && extFromFilename(dn)) || extFromUrl(href) || '(desconhecido)';
          BLOCK('anchor-programmatic', hasPolicy ? `Bloqueado: .${ext}` : 'Bloqueado: nenhuma policy carregada');
          return; // bloqueado
        }
      }
      return _aClick.apply(this, args);
    }
  });

  // window.open
  const _open = window.open;
  Object.defineProperty(window, 'open', {
    configurable: true, writable: true,
    value: function(url, ...rest) {
      if (!enabled) return _open.call(window, url, ...rest);
      const s = String(url || '');
      if (isWAishUrl(s) && shouldBlockByExt(s, '')) {
        const ext = extFromUrl(s) || '(desconhecido)';
        BLOCK('window-open', hasPolicy ? `Bloqueado: .${ext}` : 'Bloqueado: nenhuma policy carregada');
        return null;
      }
      return _open.call(window, url, ...rest);
    }
  });

  // tecla Enter em <a>
  window.addEventListener('keydown', (e) => {
    if (!enabled) return;
    if (e.key !== 'Enter') return;
    const a = document.activeElement;
    if (!(a instanceof HTMLAnchorElement)) return;
    const href = a.getAttribute('href') || a.href || '';
    if (!isWAishUrl(href)) return;
    const dn = a.getAttribute('download') || a.download || '';
    if (shouldBlockByExt(href, dn)) {
      e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
      const ext = (dn && extFromFilename(dn)) || extFromUrl(href) || '(desconhecido)';
      BLOCK('anchor-enter', hasPolicy ? `Bloqueado: .${ext}` : 'Bloqueado: nenhuma policy carregada');
    }
  }, true);

  console.debug('[WA DL Guard] Content script ativo — toggle respected (enabled=', enabled, ').');
})();
