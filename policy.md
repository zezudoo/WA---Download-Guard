# Guia de Policy (Allowlist) — WA - Download Guard 🛡️

Este documento explica **como criar e manter** a *policy* (allowlist) em **JSON** usada pela extensão para **permitir apenas tipos de arquivos seguros** vindos do WhatsApp.
A policy é hospedada em um **Gist RAW** (ou qualquer host com CORS) e carregada pela extensão com **cache** (TTL).

---

## 🔎 Visão geral

* **Formato:** JSON simples (sem comentários).
* **Semântica:** *allowlist* — **só o que você listar é permitido**; todo o resto é **bloqueado**.
* **Onde hospedar:** Gist RAW (ex.: `https://gist.githubusercontent.com/.../raw/.../allowlist.json`).
* **Cache:** respeita `ttl_seconds`. Ao expirar, a extensão busca a versão nova.
* **Sem policy válida:** a extensão opera em **modo seguro por padrão** ⇒ **bloqueia tudo** do WhatsApp.

---

## 🧩 Estrutura do JSON (schema)

```json
{
  "schema_version": 1,
  "updated_at": "YYYY-MM-DDTHH:mm:ssZ",
  "mode": "allow",
  "default_action": "block",
  "ttl_seconds": 3600,
  "allowed": {
    "extensions": ["pdf", "jpg", "png" /* ... */],
    "mime_types": ["application/pdf", "image/jpeg", "image/png" /* ... */]
  },
  "notes": "Campo opcional para documentação"
}
```

### Campo a campo

* `schema_version` (number): sempre `1` (versão atual do formato).
* `updated_at` (string ISO8601): informativo (auditoria/registro humano).
* `mode` (string): **deve ser `"allow"`**.
* `default_action` (string): **mantenha `"block"`**.
* `ttl_seconds` (number): tempo de cache (ex.: `3600` = 1 hora).
* `allowed.extensions` (string[]):

  * **minúsculas, sem ponto** (ex.: `"pdf"`, não `".pdf"`).
  * Use a **extensão real** do arquivo final.
* `allowed.mime_types` (string[]):

  * **minúsculas**, valores MIME válidos (ex.: `"application/pdf"`).
  * Adicione todas as variações realistas do seu ambiente (ex.: CSV às vezes vem como `application/vnd.ms-excel`).
* `notes` (string): livre (informativo).

---

## 🧠 Como a extensão decide (regra de permissão)

**Content Script (na página do WhatsApp):**

* **Sem policy carregada:** bloqueia **tudo** na origem (toast na página).
* **Com policy carregada:** bloqueia quando a **extensão** é detectada e não está na allowlist; se não houver extensão detectável, o SW decide.

**Service Worker (downloads):**

* **Sem policy:** bloqueia **tudo**.
* **Com policy:**

  * Se **MIME** existir:

    * **Precisa** estar em `allowed.mime_types`;
    * **E**, se houver **extensão**, ela **também** precisa estar em `allowed.extensions`.
    * **MIME genérico** (ex.: `application/octet-stream`) é tratado como ausente.
  * Se **MIME** **não** existir:

    * Exige que a **extensão** esteja em `allowed.extensions`.

> ✅ **Recomendação:** Ao liberar um tipo, **adicione a extensão e o(s) MIME(s)** correspondentes.

---

## ✅ Boas práticas de segurança

* **NÃO** libere executáveis / scripts / instaladores / compactadores:

  * `exe`, `msi`, `bat`, `cmd`, `ps1`, `vbs`, `js`, `jse`, `jar`, `apk`, `dmg`, `pkg`, `iso`, `scr`, `hta`
  * `zip`, `rar`, `7z` (muito usados como vetor de malware)
* Evite formatos Office com macros: `docm`, `xlsm`, `pptm` (e também os antigos `doc`, `xls`, `ppt`).
* **Minúsculas** em tudo; **sem ponto** em extensões.
* Seja **conservador**: libere apenas o que é realmente necessário para o trabalho.

---

## 🧪 Exemplos práticos

### 1) Liberar **PDF**

```json
{
  "allowed": {
    "extensions": ["pdf"],
    "mime_types": ["application/pdf"]
  }
}
```

### 2) Liberar **imagens comuns**

```json
{
  "allowed": {
    "extensions": ["jpg", "jpeg", "png", "gif", "webp"],
    "mime_types": ["image/jpeg", "image/png", "image/gif", "image/webp"]
  }
}
```

### 3) Liberar **CSV** (inclui variação de MIME)

```json
{
  "allowed": {
    "extensions": ["csv"],
    "mime_types": ["text/csv", "application/vnd.ms-excel"]
  }
}
```

### 4) Liberar **SVG** (⚠️ atenção — pode embutir script)

```json
{
  "allowed": {
    "extensions": ["svg"],
    "mime_types": ["image/svg+xml"]
  }
}
```

> ⚠️ Só libere **SVG** se for indispensável.

---

## 📚 Tabela rápida de MIME comuns

| Categoria     | Extensão(ões) | MIME principal(is)                                                          |
| ------------- | ------------- | --------------------------------------------------------------------------- |
| PDF           | `pdf`         | `application/pdf`                                                           |
| Imagem        | `jpg`,`jpeg`  | `image/jpeg`                                                                |
|               | `png`         | `image/png`                                                                 |
|               | `gif`         | `image/gif`                                                                 |
|               | `webp`        | `image/webp`                                                                |
|               | `bmp`         | `image/bmp`                                                                 |
|               | `heic`,`heif` | `image/heic`, `image/heif`                                                  |
| Áudio         | `mp3`         | `audio/mpeg`                                                                |
|               | `wav`         | `audio/wav`                                                                 |
|               | `m4a`         | `audio/mp4`                                                                 |
| Vídeo         | `mp4`         | `video/mp4`                                                                 |
|               | `mov`         | `video/quicktime`                                                           |
|               | `webm`        | `video/webm`                                                                |
| Texto / Dados | `txt`         | `text/plain`                                                                |
|               | `json`        | `application/json`                                                          |
|               | `csv`         | `text/csv`, `application/vnd.ms-excel`                                      |
| Calendário    | `ics`         | `text/calendar`                                                             |
| Contato       | `vcf`         | `text/vcard`, `text/x-vcard`                                                |
| Office OOXML  | `docx`        | `application/vnd.openxmlformats-officedocument.wordprocessingml.document`   |
|               | `xlsx`        | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`         |
|               | `pptx`        | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |

---

## 🧱 Template completo (recomendado)

> Use como base e edite apenas as listas.

```json
{
  "schema_version": 1,
  "updated_at": "2025-10-10T15:20:00Z",
  "mode": "allow",
  "default_action": "block",
  "ttl_seconds": 3600,
  "allowed": {
    "extensions": [
      "jpg","jpeg","png","gif","webp","bmp","heic","heif",
      "txt","csv","json","log",
      "pdf",
      "mp3","wav","m4a",
      "mp4","mov","webm",
      "ics","vcf",
      "docx","xlsx","pptx"
    ],
    "mime_types": [
      "image/jpeg","image/png","image/gif","image/webp","image/bmp","image/heic","image/heif",
      "text/plain","text/csv","application/json","text/markdown","text/yaml",
      "application/pdf",
      "audio/mpeg","audio/wav","audio/mp4",
      "video/mp4","video/quicktime","video/webm",
      "text/calendar",
      "text/vcard","text/x-vcard",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ]
  },
  "notes": "Explique aqui o racional da allowlist e quem é responsável por alterar."
}
```

---

## 🚀 Como publicar e aplicar mudanças

1. **Edite** seu Gist com o JSON (mantenha o arquivo **válido**).
2. Opcional: atualize `updated_at` (apenas informativo).
3. **Salve** o Gist (o link RAW não deve mudar; se mudar, atualize a URL na extensão).
4. Na extensão, abra **Opções** → clique em **Atualizar agora**.
5. **Teste**:

   * Baixe um tipo **liberado** → deve **passar**.
   * Baixe um tipo **não listado** → deve **bloquear** (toast e, se possível, notificação do sistema).

---

## 🛠️ Dicas de operação

* **Rollback rápido:** volte o Gist para um commit anterior ou remova o tipo problemático e salve.
* **Revisão de segurança periódica:** avalie a necessidade de cada tipo liberado.
* **Auditoria manual:** quando em dúvida, remova temporariamente da lista — a extensão é **secure-by-default** (bloqueia).

---

## ❓ FAQ

**Q:** A policy falhou de carregar. O que acontece?
**A:** A extensão **bloqueia tudo** por segurança (com toast). Ao recuperar a policy, os tipos liberados voltam a passar.

**Q:** Preciso listar **todos** os MIME possíveis?
**A:** Liste os **principais** que você vê no seu ambiente. O SW exige MIME permitido **e** extensão permitida quando o MIME vier presente; quando não vier, a decisão cai só na extensão.

**Q:** Posso permitir só por MIME?
**A:** **Não recomendado.** Mantenha **extensão e MIME** — isso reduz falsos positivos e aumenta segurança.

---

## 🧾 Changelog sugerido (no seu Gist)

Mantenha um histórico simples no campo `notes` ou em um arquivo separado:

```
2025-10-10: Versão inicial (imagens, PDF, Office OOXML, mídia).
2025-10-13: Adicionado CSV (application/vnd.ms-excel).
...
```
