// sw.js (type: module)

// ===================== Config =====================
const STORAGE = {
  enabled: 'enabled',
  configUrl: 'configUrl',
  policy: 'policy',
  policyFetchedAt: 'policyFetchedAt'
};

// Sem policy hardcoded. Apenas a URL padrão do seu Gist:
const DEFAULT_CONFIG_URL =
  'https://gist.githubusercontent.com/zezudoo/3af8883fd0699ae5b6e6fd5443c4e41e/raw/6a9186bcffb443a82070d1e6ed74948f2045def0/allowlist_wa_guard.json';

const HOST_RE = /(^|\.)whatsapp\.(com|net)$/i;
const WAME_RE = /^wa\.me$/i;

// ===================== Utils =====================
const getHost = (u) => { try { return new URL(u).hostname; } catch { return ''; } };
const isWAHost = (h) => HOST_RE.test(h) || WAME_RE.test(h);
const isWAUrl  = (u) => !!u && isWAHost(getHost(u));
const isBlobOrData = (u) => typeof u === 'string' && (u.startsWith('blob:') || u.startsWith('data:'));
const lower = (s) => (typeof s === 'string' ? s.toLowerCase() : '');

const extFromFilename = (name) => {
  if (!name) return '';
  const clean = name.split(/[?#]/)[0];
  const last = clean.split('/').pop() || '';
  const dot = last.lastIndexOf('.');
  if (dot <= 0) return '';
  return last.slice(dot + 1).toLowerCase();
};
const extFromUrl = (url) => { try { return extFromFilename(new URL(url).pathname); } catch { return ''; } };

// ===================== Notificações =====================
async function notify(message, title = 'WhatsApp Download Guard') {
  try {
    await chrome.notifications.create('', {
      type: 'basic',
      iconUrl: 'icons/128.png',
      title,
      message,
      priority: 1
    });
  } catch {}
}

async function cancelAndErase(id) {
  try { await chrome.downloads.cancel(id); } catch {}
  try { await chrome.downloads.erase({ id }); } catch {}
}

// ===================== Policy remota =====================
async function getConfigUrl() {
  const { [STORAGE.configUrl]: url } = await chrome.storage.local.get(STORAGE.configUrl);
  return url || DEFAULT_CONFIG_URL;
}

async function getCachedPolicy() {
  const data = await chrome.storage.local.get([STORAGE.policy, STORAGE.policyFetchedAt]);
  return {
    policy: data[STORAGE.policy] || null,
    fetchedAt: data[STORAGE.policyFetchedAt] || 0
  };
}

async function savePolicy(policy) {
  await chrome.storage.local.set({
    [STORAGE.policy]: policy,
    [STORAGE.policyFetchedAt]: Math.floor(Date.now() / 1000)
  });
}

async function refreshPolicy(nonBlocking = true) {
  const url = await getConfigUrl();
  const doFetch = async () => {
    try {
      const res = await fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // validações mínimas
      if (!json || json.mode !== 'allow' || !json.allowed ||
          !Array.isArray(json.allowed.extensions) || !Array.isArray(json.allowed.mime_types)) {
        throw new Error('Policy inválida');
      }
      await savePolicy(json);
    } catch (e) {
      console.debug('[WA DL Guard] refreshPolicy falhou:', e?.message || e);
    }
  };
  if (nonBlocking) doFetch(); else await doFetch();
}

async function getPolicyForDecision() {
  const { policy, fetchedAt } = await getCachedPolicy();
  if (policy && Number.isFinite(policy.ttl_seconds)) {
    const now = Math.floor(Date.now() / 1000);
    if (now - (fetchedAt || 0) >= Number(policy.ttl_seconds)) {
      refreshPolicy(true); // atualiza em background
    }
    return policy;
  }
  // sem policy no cache → tenta atualizar em background e retorna null
  refreshPolicy(true);
  return null;
}

// ===================== Toggle =====================
async function isEnabled() {
  const { [STORAGE.enabled]: enabled } = await chrome.storage.local.get(STORAGE.enabled);
  return enabled !== false; // default true
}

// ===================== Origem WhatsApp =====================
function isFromWhatsApp(item) {
  if (item?.byExtensionId === chrome.runtime.id) return false;

  const url = item?.finalUrl || item?.url || '';
  const ref = item?.referrer || '';
  if (isWAUrl(url)) return true;
  if (isWAUrl(ref)) return true;
  // blob/data vindos do WA frequentemente chegam sem referrer — trate como WA
  if (isBlobOrData(url)) return true;
  return false;
}

// ===================== Decisão allow/block =====================
// Sem policy → BLOCK ALL (seguro por padrão).
function decideAllow(policy, { url, filename, mime }) {
  if (!policy) return false;

  const allowedExts = new Set((policy?.allowed?.extensions || []).map(lower));
  const allowedMimes = new Set((policy?.allowed?.mime_types || []).map(lower));

  const mimeL = lower(mime || '');
  let ext = extFromFilename(filename || '') || extFromUrl(url || '');
  ext = lower(ext);

  // Regras mais rígidas:
  if (mimeL) {
    if (!allowedMimes.has(mimeL)) return false;
    if (ext && !allowedExts.has(ext)) return false;
    return true;
  } else {
    return !!ext && allowedExts.has(ext);
  }
}

// ===================== Hooks de downloads =====================
// NÃO chamar suggest().

chrome.downloads.onDeterminingFilename.addListener(async (item /*, suggest */) => {
  try {
    if (!(await isEnabled())) return;
    if (!isFromWhatsApp(item)) return;

    const policy = await getPolicyForDecision();
    const allow = decideAllow(policy, {
      url: item.finalUrl || item.url || '',
      filename: item.filename || '',
      mime: item.mime || ''
    });

    if (!allow) {
      await cancelAndErase(item.id);
      await notify('Download do WhatsApp bloqueado pela política.');
    }
  } catch (e) {
    console.debug('[WA DL Guard] erro onDeterminingFilename:', e?.message || e);
  }
});

// Fallback
chrome.downloads.onCreated.addListener(async (item) => {
  try {
    if (!(await isEnabled())) return;
    if (!isFromWhatsApp(item)) return;

    const policy = await getPolicyForDecision();
    const allow = decideAllow(policy, {
      url: item.finalUrl || item.url || '',
      filename: item.filename || '',
      mime: item.mime || ''
    });

    if (!allow) {
      await cancelAndErase(item.id);
      await notify('Download do WhatsApp bloqueado (fallback).');
    }
  } catch (e) {
    console.debug('[WA DL Guard] erro onCreated:', e?.message || e);
  }
});

// Mensagens (options + toasts do content script)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === 'refresh-policy') {
    (async () => {
      try {
        await refreshPolicy(false);
        const { policy, fetchedAt } = await getCachedPolicy();
        sendResponse({ ok: !!policy, fetchedAt, summary: policy ? {
          ext: policy?.allowed?.extensions?.length || 0,
          mime: policy?.allowed?.mime_types?.length || 0
        } : null });
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'wa-blocked-notify') {
    notify('Ação de download bloqueada no WhatsApp.');
  }
});

// Bootstrap
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get([STORAGE.enabled, STORAGE.configUrl]);
  if (!Object.prototype.hasOwnProperty.call(data, STORAGE.enabled)) {
    await chrome.storage.local.set({ [STORAGE.enabled]: true });
  }
  if (!data[STORAGE.configUrl]) {
    await chrome.storage.local.set({ [STORAGE.configUrl]: DEFAULT_CONFIG_URL });
  }
  // sem policy default — apenas tenta buscar
  refreshPolicy(true);
});
