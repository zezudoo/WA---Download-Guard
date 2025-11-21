const STORAGE = {
  enabled: 'enabled',
  configUrl: 'configUrl',
  policy: 'policy',
  policyFetchedAt: 'policyFetchedAt'
};

const DEFAULT_CONFIG_URL =
  'https://wazap.coopavel.com.br:8090/allowlist_wa_guard.json';

const $ = (id) => document.getElementById(id);

async function load() {
  const data = await chrome.storage.local.get([
    STORAGE.enabled,
    STORAGE.configUrl,
    STORAGE.policy,
    STORAGE.policyFetchedAt
  ]);

  // força o enabled sempre true e bloqueia o checkbox
  const enabledCheckbox = $('enabled');
  if (enabledCheckbox) {
    enabledCheckbox.checked = true;
    enabledCheckbox.disabled = true;
  }

  $('configUrl').value = data[STORAGE.configUrl] || DEFAULT_CONFIG_URL;

  const p = data[STORAGE.policy];
  const ts = data[STORAGE.policyFetchedAt];
  const ageSec = ts ? Math.max(0, Math.floor(Date.now() / 1000 - ts)) : null;

  $('info').textContent = p
    ? `Policy cache: mode=${p.mode} • allowed.ext=${p?.allowed?.extensions?.length || 0} • allowed.mime=${p?.allowed?.mime_types?.length || 0} • atualizado há ${ageSec ?? '?'}s`
    : 'Nenhuma policy carregada — por segurança todos downloads do WhatsApp serão bloqueados.';
}

async function save() {
  // força o enabled como true SEM depender do checkbox
  const enabled = true;
  const configUrl = $('configUrl').value.trim() || DEFAULT_CONFIG_URL;

  await chrome.storage.local.set({
    [STORAGE.enabled]: enabled,
    [STORAGE.configUrl]: configUrl
  });

  document.getElementById('status').textContent = 'Salvo.';
  document.getElementById('status').className = 'ok';
  setTimeout(() => (document.getElementById('status').textContent = ''), 1500);
}

async function refresh() {
  const status = document.getElementById('status');
  status.textContent = 'Atualizando…';
  status.className = '';
  const res = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'refresh-policy' }, resolve);
  });
  if (res?.ok) {
    status.textContent = 'Atualizado ✅';
    status.className = 'ok';
  } else {
    status.textContent = 'Falha ao atualizar (sem policy; bloqueio total).';
    status.className = 'err';
  }
  await load();
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('refresh').addEventListener('click', refresh);
window.addEventListener('DOMContentLoaded', load);
