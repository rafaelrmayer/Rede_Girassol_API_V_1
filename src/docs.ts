export const DOCS_HTML = String.raw`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Rede Girassol · Documentação da API</title>
<style>
:root {font-family:Inter,system-ui,sans-serif;color:#24312c;background:#f7faf6;line-height:1.6}
* {box-sizing:border-box} body {margin:0} main {max-width:1080px;margin:auto;padding:28px 20px 60px}
a {color:#245247} button,input {font:inherit} a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible {outline:3px solid #b78b30;outline-offset:3px}
header {display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;margin-bottom:24px}
.eyebrow {font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#326b5b;margin:0} h1 {font-size:clamp(24px,4vw,36px);line-height:1.2;margin:8px 0;color:#142f29} h2 {font-size:21px;margin-top:32px} h3 {font-size:16px}
.actions {display:flex;gap:12px;flex-wrap:wrap}.button,button {border:1px solid #cad9ce;background:#fff;border-radius:9px;padding:10px 14px;font-size:13px;cursor:pointer;color:#173b32;text-decoration:none}.primary {background:#245247;color:white;border-color:#245247}button:disabled {opacity:.55;cursor:wait}
.notice {padding:17px 20px;background:#fff7e6;border:1px solid #e9d6a8;border-radius:12px;font-size:14px}
.description {white-space:pre-line;font-size:14px;color:#526458}.endpoint, .model {background:white;border:1px solid #dce7df;border-radius:12px;margin:14px 0;overflow:hidden}summary {padding:17px 20px;cursor:pointer;font-weight:650;color:#173b32;overflow-wrap:anywhere}.body {padding:0 20px 20px}.method {font-size:12px;display:inline-block;border-radius:5px;background:#e6f3e9;color:#245247;padding:3px 7px;margin-right:8px}
.path {font-family:ui-monospace,monospace}form {display:grid;gap:12px}label {display:grid;gap:5px;font-weight:600;font-size:13px}input {border:1px solid #bdcec1;border-radius:8px;padding:10px;color:#24312c;max-width:100%;width:100%;background:white}.field-description {font-weight:400;color:#617268;font-size:12px}form button {justify-self:start}pre {max-height:420px;overflow:auto;padding:15px;background:#f2f6f1;border:1px solid #dce7df;border-radius:9px;font:12px/1.65 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}code {font-family:ui-monospace,monospace} .status {font-size:13px;font-weight:600;color:#245247}.failure {color:#a33f36}.muted {font-size:13px;color:#617268}footer {margin-top:32px;border-top:1px solid #dce7df;padding-top:18px;font-size:12px;color:#617268}
@media(min-width:760px) {.fields {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}}
</style>
</head>
<body><main>
<header><div><p class="eyebrow">Rede Girassol · API experimental</p><h1>Documentação da API</h1><p id="version" class="muted">Carregando definição OpenAPI…</p></div><nav class="actions" aria-label="Links da documentação"><a href="/" class="button">Voltar ao painel</a><a href="/openapi.json" download="rede-girassol-openapi.json" class="button primary">Baixar OpenAPI JSON</a></nav></header>
<p class="notice"><strong>Cobertura parcial.</strong> As consultas usam os registros já importados no banco. Não há garantia de cobertura nacional ou municipal completa. O CNES não comprova rede credenciada ou disponibilidade atual de serviços. Operadoras e planos ANS dependem das respectivas cargas completas validadas; confira disponibilidade e datas em /sources. Não há rede credenciada integrada.</p>
<p class="description">Abra uma consulta para ver parâmetros, exemplos de formato e testar uma requisição GET neste mesmo serviço. Os exemplos de estabelecimentos são fictícios; o resultado do teste vem da API consultada.</p>
<div id="loadStatus" role="status" aria-live="polite"></div><section aria-label="Consultas públicas" id="endpoints"></section>
<h2>Modelos de resposta</h2><p class="muted">Os nomes referenciados por $ref estão definidos abaixo e no arquivo OpenAPI.</p><div id="models"></div>
<footer>Rede Girassol · Rafael Ricardo Mayer. As consultas públicas atuais não exigem token. Esta página oferece somente operações GET.</footer>
</main><script>
"use strict";
const byId = function (id) { return document.getElementById(id); };
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function resolve(spec, value) {
  if (!value || !value.$ref) return value;
  return value.$ref.split("/").slice(1).reduce(function (target, part) { return target[part]; }, spec);
}
function makeEndpoint(spec, path, operation) {
  const details = node("details", undefined, "endpoint");
  details.id = operation.operationId;
  const summary = node("summary");
  summary.append(node("span", "GET", "method"), node("span", path, "path"), document.createTextNode(" · " + operation.summary));
  const body = node("div", undefined, "body");
  body.appendChild(node("p", operation.description, "description"));
  const form = node("form");
  const fields = node("div", undefined, "fields");
  const inputs = [];
  (operation.parameters || []).forEach(function (raw) {
    const parameter = resolve(spec, raw);
    const label = node("label", parameter.name + (parameter.required ? " (obrigatório)" : " (opcional)"));
    const input = node("input");
    input.id = operation.operationId + "-" + parameter.name;
    label.htmlFor = input.id;
    input.name = parameter.name;
    input.type = parameter.schema.type === "integer" ? "number" : "text";
    input.required = Boolean(parameter.required);
    if (input.type === "number") {
      input.step = "1";
      if (parameter.schema.minimum !== undefined) input.min = String(parameter.schema.minimum);
      if (parameter.schema.maximum !== undefined) input.max = String(parameter.schema.maximum);
    }
    if (parameter.schema.default !== undefined) input.value = String(parameter.schema.default);
    else if (parameter.in === "path" && parameter.example) input.value = parameter.example;
    const description = node("span", parameter.description, "field-description");
    description.id = input.id + "-description";
    input.setAttribute("aria-describedby", description.id);
    label.append(input, description); fields.appendChild(label);
    inputs.push({parameter: parameter, input: input});
  });
  const submit = node("button", "Testar consulta GET", "primary");
  submit.type = "submit";
  form.append(fields, submit);
  const status = node("p", "Nenhuma requisição executada.", "status");
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
  const curl = node("pre", "O exemplo cURL será gerado ao testar a consulta.");
  const output = node("pre", "O resultado da API aparecerá aqui.");
  output.setAttribute("aria-label", "Resposta da API");
  const copy = node("button", "Copiar cURL"); copy.type = "button"; copy.disabled = true;
  let command = "";
  copy.addEventListener("click", async function () {
    try { await navigator.clipboard.writeText(command); copy.textContent = "cURL copiado"; }
    catch (_) { copy.textContent = "Selecione e copie o exemplo abaixo"; }
  });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    let requestedPath = path;
    const params = new URLSearchParams();
    inputs.forEach(function (field) {
      const value = field.input.value.trim();
      if (field.parameter.in === "path") requestedPath = requestedPath.replace("{" + field.parameter.name + "}", encodeURIComponent(value));
      else if (value !== "") params.set(field.parameter.name, value);
    });
    const url = new URL(requestedPath, location.origin);
    url.search = params.toString();
    // Single quotes prevent shell substitutions in query text.
    const quote = function (value) { return "'" + value.replace(/'/g, "'\\''") + "'"; };
    command = "curl --request GET " + quote(url.href) + " --header 'Accept: application/json'";
    curl.textContent = command; copy.disabled = false; copy.textContent = "Copiar cURL";
    submit.disabled = true; status.textContent = "Consultando…"; status.className = "status";
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 20000);
    try {
      const response = await fetch(url.href, {method: "GET", headers: {Accept: "application/json"}, cache: "no-store", signal: controller.signal});
      status.textContent = "HTTP " + response.status;
      if (!response.ok) status.className = "status failure";
      const text = await response.text();
      try { output.textContent = JSON.stringify(JSON.parse(text), null, 2); }
      catch (_) { output.textContent = text; }
    } catch (error) {
      status.className = "status failure";
      status.textContent = error.name === "AbortError" ? "A consulta excedeu 20 segundos." : "Não foi possível consultar a API.";
      output.textContent = "Confira sua conexão e tente novamente.";
    } finally { clearTimeout(timeout); submit.disabled = false; }
  });
  body.append(form, status, node("h3", "Exemplo cURL"), copy, curl, node("h3", "Resposta da consulta"), output);
  const responses = node("details"); responses.appendChild(node("summary", "Respostas e exemplos de formato"));
  Object.keys(operation.responses).forEach(function (code) {
    const response = resolve(spec, operation.responses[code]);
    responses.appendChild(node("h3", "HTTP " + code));
    responses.appendChild(node("p", response.description, "description"));
    const content = response.content && response.content["application/json"];
    if (content) {
      responses.appendChild(node("pre", JSON.stringify(content.schema, null, 2)));
      Object.values(content.examples || {}).forEach(function (example) {
        if (example.summary) responses.appendChild(node("p", example.summary, "muted"));
        responses.appendChild(node("pre", JSON.stringify(example.value, null, 2)));
      });
    }
  });
  body.appendChild(responses); details.append(summary, body); return details;
}
async function load() {
  try {
    const response = await fetch("/openapi.json", {headers: {Accept: "application/json"}, cache: "no-store"});
    if (!response.ok) throw new Error("OpenAPI indisponível");
    const spec = await response.json();
    byId("version").textContent = "Versão " + spec.info.version + " · OpenAPI " + spec.openapi;
    Object.entries(spec.paths).forEach(function (entry) {
      if (entry[1].get) byId("endpoints").appendChild(makeEndpoint(spec, entry[0], entry[1].get));
    });
    Object.entries(spec.components.schemas).forEach(function (entry) {
      const details = node("details", undefined, "model");
      details.append(node("summary", entry[0]), node("pre", JSON.stringify(entry[1], null, 2)));
      byId("models").appendChild(details);
    });
    byId("loadStatus").textContent = "Definição carregada. Escolha uma consulta abaixo.";
  } catch (_) { byId("loadStatus").textContent = "Não foi possível carregar a definição. Recarregue a página para tentar novamente."; }
}
load();
</script></body></html>`;
