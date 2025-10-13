# WA - Download Guard 🛡️

Bloqueio inteligente de **downloads no WhatsApp Web** para reduzir risco de malware e vazamento de dados.

> **Manifest:** v3 • **Alvo:** `https://web.whatsapp.com/*`
> **Propósito único:** bloquear automaticamente downloads de tipos de arquivo não permitidos no WhatsApp Web.

---

## Índice

- [WA - Download Guard 🛡️](#wa---download-guard-️)
  - [Índice](#índice)
  - [Apresentação](#apresentação)
  - [Recursos](#recursos)
  - [Como funciona](#como-funciona)
  - [Instalação (desenvolvimento)](#instalação-desenvolvimento)
  - [Permissões \& Privacidade](#permissões--privacidade)
  - [Configuração](#configuração)
  - [Políticas (policy.md)](#políticas-policymd)
  - [Estrutura do projeto](#estrutura-do-projeto)
  - [FAQ / Solução de problemas](#faq--solução-de-problemas)

---

## Apresentação

O **WA - Download Guard** monitora downloads iniciados no **WhatsApp Web** e **bloqueia automaticamente** arquivos que não estão na lista permitida. É simples, direto e pensado pra uso real do dia a dia. Minha opinião: o grande trunfo aqui é o **preload das regras** — é o que fecha a principal brecha de segurança.

---

## Recursos

* ✅ **Bloqueio sempre ativo** — não existe opção para desativar nas configurações.
* ✅ **Preload das regras** — carrega/recacheia as listas ao iniciar o navegador, ao instalar/atualizar a extensão e ao abrir o WhatsApp Web.
* ✅ **Listas flexíveis** — por **extensão** (ex.: `.zip`, `.exe`, `.js`) e, opcionalmente, por **MIME type**.
* ✅ **Aviso amigável** — feedback visual quando um download é bloqueado.
* ✅ **100% local** — nada sai do navegador; sem backend.

---

## Como funciona

1. O **service worker** (background) observa `chrome.downloads.*`.
2. Se a origem for **WhatsApp Web**, verifica extensão/MIME do arquivo.
3. Se **não permitido**, cancela o download e registra o motivo (e mostra um aviso, se ativado).
4. As **regras** vivem no `chrome.storage` e são recarregadas em:

   * `onInstalled` / `onStartup`
   * Quando detectar/ativar uma aba `web.whatsapp.com`

---

## Instalação (desenvolvimento)

1. Baixe/clone o projeto.
2. Abra `chrome://extensions/` e ative **Modo do desenvolvedor**.
3. Clique **Carregar sem compactação** e selecione a pasta da extensão.
4. Abra o **WhatsApp Web** e tente baixar algo proibido (ex.: `.zip`) para validar.

> Dica: pra empacotar localmente, use **“Empacotar extensão…”** em `chrome://extensions/`.

---

## Permissões & Privacidade

**Permissões**

* `downloads`: interceptar/cancelar downloads não permitidos.
* `storage`: guardar configurações e listas localmente.
* Host `https://web.whatsapp.com/*`: monitorar somente essa origem.

**Privacidade**

* **Sem coleta de dados pessoais.**
* **Sem chamadas externas.**
* Tudo fica **no seu navegador**.

---

## Configuração

Abra a página de **Opções** para ajustar as regras.
Não há controle de ligar/desligar — o bloqueio é sempre ativo.

**Exemplo de configuração (conceito):**

```json
{
  "mode": "denylist",
  "deny": ["exe", "bat", "cmd", "js", "jar", "msi", "ps1", "zip", "rar", "7z"],
  "allow": [],
  "mimeDeny": ["application/x-msdownload"],
  "showToast": true
}
```

* **mode**: `denylist` (bloquear lista) ou `allowlist` (permitir só a lista).
* **deny/allow**: extensões sem ponto (ex.: `"zip"`).
* **mimeDeny**: bloqueio por MIME, se precisar.
* **showToast**: habilita/desabilita o aviso visual.

---

## Políticas (policy.md)

Este repositório inclui um guia de políticas em [`policy.md`](./policy.md).
Lá você encontra:

* Objetivo e escopo da extensão (propósito único).
* Diretrizes de **criação/alteração** das listas de bloqueio/permitidos.
* Justificativas de permissões e boas práticas de privacidade.
* Padrões de mensagem ao usuário (ex.: textos de bloqueio/aviso).
* Processo de revisão de mudanças (como propor e aprovar updates).
* Versionamento e registro de alterações de política.

> Qualquer mudança de comportamento da extensão que impacte regras, mensagens ou permissões **deve** seguir o fluxo descrito no `policy.md`.

---

## Estrutura do projeto

```
/ (raiz)
├─ manifest.json                # Manifest V3
├─ sw.js                        # Service worker (background) — bloqueio + preload das regras
├─ content-whatsapp.js          # Content script para UI/integrações no WhatsApp Web
├─ options/
│  ├─ options.html              # Página de opções
│  └─ options.js
├─ icons/
│  ├─ 16.png
│  ├─ 32.png
│  ├─ 48.png
│  └─ 128.png
├─ policy.md                    # Guia oficial de políticas do projeto
└─ readme.md
```

---

## FAQ / Solução de problemas

**“O primeiro download proibido passou.”**

* Verifique se o preload roda em `onInstalled`, `onStartup` e ao abrir `web.whatsapp.com`.
* Feche e reabra o Chrome pra validar o fluxo de inicialização.

**“Quero liberar só PDF e PNG.”**

* Use `allowlist` com `["pdf", "png"]`. O resto vai ser bloqueado.

**“Apareceram dois avisos (toasts) por um único bloqueio.”**

* Garanta que o toast é disparado **uma única vez por evento** (evite múltiplos listeners).

**“Funciona em outros sites?”**

* O foco é **WhatsApp Web**. Outras origens não são alvo do projeto.

---
