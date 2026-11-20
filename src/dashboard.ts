export const DASHBOARD_HTML = String.raw\`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#173b32">
  <title>Rede Girassol · Painel</title>
  <style>
    :root {
      --green-950: #142f29;
      --green-900: #173b32;
      --green-800: #245247;
      --green-700: #326b5b;
      --green-100: #e9f1ec;
      --green-50: #f4f7f3;
      --gold: #d8ad4f;
      --gold-soft: #f8f0dc;
      --ink: #24312c;
      --muted: #69766f;
      --line: #e1e8e2;
      --paper: #fbfcf9;
      --white: #ffffff;
      --danger: #a33f36;
      --danger-bg: #fbefed;
      --shadow: 0 12px 34px rgba(20, 47, 41, .07);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; color: var(--ink); background: var(--paper); min-height: 100vh; }
    button, input { font: inherit; }
    button:focus-visible, input:focus-visible, a:focus-visible {
      outline: 3px solid #c18e2c; outline-offset: 3px;
    }
    .app { display: grid; grid-template-columns: 252px minmax(0, 1fr); min-height: 100vh; }
    .sidebar {
      background: var(--green-950); color: #edf4ef; padding: 28px 18px;
      display: flex; flex-direction: column; gap: 30px;
    }
    .brand { display: flex; gap: 12px; align-items: center; padding: 0 10px; }
    .brand-mark {
      width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center;
      color: var(--green-950); background: var(--gold); font-size: 24px;
    }
    .brand-name { margin: 0; font-size: 17px; font-weight: 750; letter-spacing: -.03em; }
    .brand-sub { margin: 3px 0 0; color: #b8cbc1; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
    .nav-label { margin: 0 10px 9px; color: #9eb5aa; font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
    .nav { display: grid; gap: 5px; }
    .nav button {
      border: 0; background: transparent; color: #d5e1da; text-align: left;
      display: flex; align-items: center; gap: 12px; padding: 12px 13px;
      border-radius: 11px; cursor: pointer; font-size: 13px; font-weight: 550;
    }
    .nav button:hover { background: rgba(255,255,255,.08); color: white; }
    .nav button[aria-current="page"] { background: #2b5549; color: white; box-shadow: inset 3px 0 var(--gold); }
    .nav-icon { width: 19px; text-align: center; font-size: 16px; }
    .sidebar-foot { margin-top: auto; border-top: 1px solid rgba(255,255,255,.14); padding: 17px 10px 0; color: #a9beb3; font-size: 11px; line-height: 1.6; }
    .sidebar-foot strong { display: block; color: #f2f6f2; font-size: 12px; margin-bottom: 3px; }
    main { min-width: 0; padding: 30px clamp(18px, 4vw, 54px) 56px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 34px; }
    .eyebrow { margin: 0 0 7px; color: var(--green-700); font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; color: var(--green-950); font-size: clamp(25px, 3vw, 34px); line-height: 1.15; letter-spacing: -.045em; }
    .top-actions { display: flex; align-items: center; gap: 10px; }
    .api-pill { display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid var(--line); background: var(--white); border-radius: 999px; color: var(--muted); font-size: 12px; white-space: nowrap; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #aab5ae; }
    .dot.ok { background: #2f946c; box-shadow: 0 0 0 3px #e5f3eb; }
    .dot.fail { background: var(--danger); box-shadow: 0 0 0 3px #f8e7e5; }
    .refresh {
      display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line);
      background: white; color: var(--green-900); border-radius: 10px; padding: 10px 13px;
      cursor: pointer; font-size: 12px; font-weight: 700;
    }
    .refresh:hover { background: var(--green-50); }
    .intro { margin: 0 0 24px; max-width: 750px; color: var(--muted); line-height: 1.65; font-size: 14px; }
    .section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin: 30px 0 14px; }
    .section-head h2 { margin: 0; color: var(--green-950); font-size: 17px; letter-spacing: -.02em; }
    .section-head p { margin: 5px 0 0; color: var(--muted); font-size: 12px; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
    .metric, .panel, .source-card { background: var(--white); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); }
    .metric { padding: 19px; min-height: 142px; }
    .metric-top { display: flex; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 12px; }
    .metric-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 11px; background: var(--green-100); color: var(--green-800); font-size: 17px; }
    .metric-value { margin: 16px 0 4px; color: var(--green-950); font-size: 30px; line-height: 1; font-weight: 760; letter-spacing: -.05em; }
    .metric-note { color: var(--muted); font-size: 11px; }
    .notice { display: flex; align-items: flex-start; gap: 12px; padding: 15px 17px; margin-top: 18px; border: 1px solid #eadbb9; border-radius: 13px; background: #fcf8ed; color: #67542d; font-size: 12px; line-height: 1.6; }
    .notice strong { color: #4c3d20; }
    .notice-icon { font-size: 17px; }
    .panel { padding: 20px; }
    .panel-title { margin: 0 0 4px; font-size: 14px; color: var(--green-950); }
    .panel-copy { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
    .source-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
    .source-card { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
    .source-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .source-name { margin: 0; color: var(--green-950); font-size: 14px; font-weight: 750; }
    .status-tag { display: inline-block; border-radius: 999px; padding: 5px 8px; background: var(--gold-soft); color: #775b1e; font-size: 10px; font-weight: 750; white-space: nowrap; }
    .source-link { color: var(--green-700); font-size: 12px; font-weight: 700; text-decoration: none; }
    .source-link:hover { text-decoration: underline; }
    .view { display: none; }
    .view.active { display: block; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 18px 0 14px; }
    .search-wrap { position: relative; flex: 1 1 260px; max-width: 470px; }
    .search-wrap input {
      width: 100%; min-height: 42px; border: 1px solid var(--line); border-radius: 10px;
      background: white; padding: 0 13px 0 38px; color: var(--ink); font-size: 13px;
    }
    .search-symbol { position: absolute; left: 13px; top: 11px; color: #87938c; }
    .search-btn { border: 0; min-height: 42px; padding: 0 17px; border-radius: 10px; background: var(--green-800); color: white; font-size: 12px; font-weight: 700; cursor: pointer; }
    .search-btn:hover { background: var(--green-950); }
    .table-panel { overflow: hidden; }
    .table-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 11px; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 620px; text-align: left; }
    th { padding: 12px 15px; color: #718078; background: #f8faf7; font-size: 10px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; white-space: nowrap; }
    td { padding: 13px 15px; border-top: 1px solid #edf1ed; color: #435149; font-size: 12px; vertical-align: top; }
    td.primary { color: var(--green-950); font-weight: 700; }
    .empty { padding: 38px 20px; text-align: center; color: var(--muted); font-size: 13px; line-height: 1.6; }
    .empty strong { display: block; color: var(--green-950); margin-bottom: 5px; font-size: 14px; }
    .error { padding: 14px 16px; margin: 12px 0; border: 1px solid #efd1ce; border-radius: 11px; background: var(--danger-bg); color: var(--danger); font-size: 12px; line-height: 1.5; }
    .muted { color: var(--muted); }
    .about-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
    .about-card { padding: 20px; }
    .about-card h3 { margin: 0 0 8px; color: var(--green-950); font-size: 14px; }
    .about-card p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.7; }
    .footer { margin-top: 35px; padding-top: 18px; border-top: 1px solid var(--line); color: #87938c; font-size: 11px; line-height: 1.7; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    @media (max-width: 900px) {
      .app { grid-template-columns: 205px minmax(0,1fr); }
      .cards { grid-template-columns: repeat(2, minmax(0,1fr)); }
      .cards .metric:last-child { grid-column: span 2; }
    }
    @media (max-width: 680px) {
      .app { display: block; }
      .sidebar { padding: 13px 14px 10px; gap: 14px; }
      .brand { padding: 0 3px; }
      .brand-mark { width: 36px; height: 36px; }
      .nav-label, .sidebar-foot { display: none; }
      .nav { display: flex; overflow-x: auto; padding-bottom: 3px; }
      .nav button { flex: 0 0 auto; padding: 9px 11px; font-size: 11px; }
      main { padding: 24px 16px 42px; }
      .topbar { align-items: flex-start; margin-bottom: 25px; }
      .top-actions { flex-direction: column; align-items: flex-end; }
      .api-pill { font-size: 10px; padding: 7px 9px; }
      .refresh { padding: 8px 10px; }
      .cards, .source-grid, .about-grid { grid-template-columns: 1fr; }
      .cards .metric:last-child { grid-column: auto; }
      .metric { min-height: 118px; }
      .section-head { align-items: flex-start; flex-direction: column; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar" aria-label="Navegação principal">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">✿</div>
        <div><p class="brand-name">Rede Girassol</p><p class="brand-sub">Informação e cuidado</p></div>
      </div>
      <div>
        <p class="nav-label">Painel</p>
        <nav class="nav" aria-label="Seções do painel">
          <button type="button" data-view="overview" aria-current="page"><span class="nav-icon" aria-hidden="true">⌂</span>Visão geral</button>
          <button type="button" data-view="places"><span class="nav-icon" aria-hidden="true">✚</span>Estabelecimentos</button>
          <button type="button" data-view="operators"><span class="nav-icon" aria-hidden="true">▦</span>Operadoras</button>
          <button type="button" data-view="plans"><span class="nav-icon" aria-hidden="true">▤</span>Planos</button>
          <button type="button" data-view="sources"><span class="nav-icon" aria-hidden="true">◎</span>Fontes e transparência</button>
        </nav>
      </div>
      <div class="sidebar-foot"><strong>Rafael Ricardo Mayer</strong>Projeto independente em desenvolvimento.<br>Versão de interface 0.1</div>
    </aside>

    <main>
      <header class="topbar">
        <div>
          <p class="eyebrow">Rede Girassol API · Ambiente de desenvolvimento</p>
          <h1 id="viewTitle">Visão geral</h1>
        </div>
        <div class="top-actions">
          <div class="api-pill" role="status" aria-live="polite"><span class="dot" id="apiDot"></span><span id="apiStatus">Consultando API…</span></div>
          <button class="refresh" id="refreshAll" type="button"><span aria-hidden="true">↻</span> Atualizar</button>
        </div>
      </header>

      <section class="view active" id="overviewView" aria-labelledby="viewTitle">
        <p class="intro">Um ponto de consulta para informações públicas de saúde. O painel exibe somente o que a API efetivamente retorna; ausência de registros e falhas de consulta são informadas sem preencher a tela com exemplos.</p>
        <div class="section-head"><div><h2>Resumo da base consultada</h2><p>Quantidade retornada pelos endpoints nesta consulta. Cada endpoint limita a resposta a até 100 registros.</p></div></div>
        <div class="cards">
          <article class="metric"><div class="metric-top"><span>Estabelecimentos</span><span class="metric-icon" aria-hidden="true">✚</span></div><div class="metric-value" id="placesCount">—</div><div class="metric-note" id="placesNote">Aguardando consulta à API</div></article>
          <article class="metric"><div class="metric-top"><span>Operadoras</span><span class="metric-icon" aria-hidden="true">▦</span></div><div class="metric-value" id="operatorsCount">—</div><div class="metric-note" id="operatorsNote">Aguardando consulta à API</div></article>
          <article class="metric"><div class="metric-top"><span>Planos</span><span class="metric-icon" aria-hidden="true">▤</span></div><div class="metric-value" id="plansCount">—</div><div class="metric-note" id="plansNote">Aguardando consulta à API</div></article>
        </div>
        <div class="notice"><span class="notice-icon" aria-hidden="true">ⓘ</span><div><strong>Transparência dos dados.</strong> O cadastro de um estabelecimento no CNES não comprova, por si só, que ele integra a rede credenciada de um plano. O painel não faz essa associação sem evidência específica.</div></div>
        <div class="section-head"><div><h2>Fontes documentadas</h2><p>O estado é informado pela própria API.</p></div></div>
        <div class="source-grid" id="overviewSources"><div class="panel"><p class="panel-copy">Consultando as fontes documentadas…</p></div></div>
      </section>

      <section class="view" id="placesView" aria-labelledby="viewTitle">
        <p class="intro">Consulte estabelecimentos que já estejam cadastrados na base da API. A pesquisa não busca diretamente no CNES; ela consulta os registros disponíveis no banco conectado ao serviço.</p>
        <form class="toolbar" id="placesForm">
          <label class="search-wrap"><span class="sr-only">Pesquisar por nome ou termo</span><span class="search-symbol" aria-hidden="true">⌕</span><input id="placesQuery" type="search" placeholder="Nome do estabelecimento" autocomplete="off"></label>
          <label class="search-wrap"><span class="sr-only">Filtrar por cidade</span><input id="placesCity" type="search" placeholder="Cidade (opcional)" autocomplete="off"></label>
          <label class="search-wrap" style="flex:0 1 110px"><span class="sr-only">Filtrar por UF</span><input id="placesState" type="text" maxlength="2" placeholder="UF" autocomplete="off"></label>
          <button class="search-btn" type="submit">Pesquisar</button>
        </form>
        <div class="panel table-panel"><div class="table-meta"><span id="placesMeta">Aguardando consulta</span><span>Fonte: base atual da API</span></div><div id="placesResults" aria-live="polite"><div class="empty"><strong>Consulta ainda não realizada</strong>Use os filtros para consultar os registros disponíveis.</div></div></div>
      </section>

      <section class="view" id="operatorsView" aria-labelledby="viewTitle">
        <p class="intro">Consulte operadoras presentes na base. A presença de um registro não substitui a confirmação de situação cadastral diretamente na ANS.</p>
        <form class="toolbar" id="operatorsForm">
          <label class="search-wrap"><span class="sr-only">Pesquisar operadora</span><span class="search-symbol" aria-hidden="true">⌕</span><input id="operatorsQuery" type="search" placeholder="Nome da operadora" autocomplete="off"></label>
          <button class="search-btn" type="submit">Pesquisar</button>
        </form>
        <div class="panel table-panel"><div class="table-meta"><span id="operatorsMeta">Aguardando consulta</span><span>Fonte: base atual da API</span></div><div id="operatorsResults" aria-live="polite"><div class="empty"><strong>Consulta ainda não realizada</strong>Use a pesquisa para consultar os registros disponíveis.</div></div></div>
      </section>

      <section class="view" id="plansView" aria-labelledby="viewTitle">
        <p class="intro">Consulte produtos de saúde suplementar cadastrados. A presença de um produto não comprova cobertura, comercialização atual ou rede credenciada vigente.</p>
        <form class="toolbar" id="plansForm">
          <label class="search-wrap"><span class="sr-only">Pesquisar plano</span><span class="search-symbol" aria-hidden="true">⌕</span><input id="plansQuery" type="search" placeholder="Nome do produto ou plano" autocomplete="off"></label>
          <button class="search-btn" type="submit">Pesquisar</button>
        </form>
        <div class="panel table-panel"><div class="table-meta"><span id="plansMeta">Aguardando consulta</span><span>Fonte: base atual da API</span></div><div id="plansResults" aria-live="polite"><div class="empty"><strong>Consulta ainda não realizada</strong>Use a pesquisa para consultar os registros disponíveis.</div></div></div>
      </section>

      <section class="view" id="sourcesView" aria-labelledby="viewTitle">
        <p class="intro">A Rede Girassol pretende utilizar fontes oficiais e manter origem, data de referência e limites de cada conjunto de dados. A integração só será tratada como concluída depois de implementada e validada.</p>
        <div class="source-grid" id="allSources"><div class="panel"><p class="panel-copy">Consultando as fontes documentadas…</p></div></div>
        <div class="section-head"><div><h2>Critérios de transparência</h2><p>Regras que orientam a apresentação das informações.</p></div></div>
        <div class="about-grid">
          <article class="panel about-card"><h3>Origem e atualização</h3><p>Exibir a fonte e a data de referência quando estiverem disponíveis. Não presumir que um registro está atualizado quando a data não foi fornecida.</p></article>
          <article class="panel about-card"><h3>Vínculo com rede credenciada</h3><p>Não inferir que um estabelecimento atende determinado plano apenas por constar no CNES ou por existir um produto associado a uma operadora.</p></article>
          <article class="panel about-card"><h3>Ausência de registros</h3><p>Uma consulta vazia deve continuar vazia. Não inserir exemplos ou dados demonstrativos em resultados apresentados como se fossem oficiais.</p></article>
          <article class="panel about-card"><h3>Limites desta versão</h3><p>A integração, normalização e persistência dos arquivos oficiais CNES e ANS ainda precisam ser implementadas e testadas.</p></article>
        </div>
      </section>

      <footer class="footer">Rede Girassol API · Interface V0.1 · Rafael Ricardo Mayer<br>Ambiente de desenvolvimento. Esta interface não confirma disponibilidade, cobertura ou credenciamento de serviços de saúde.</footer>
    </main>
  </div>
  <script>
    "use strict";
    const titles = {
      overview: "Visão geral",
      places: "Estabelecimentos",
      operators: "Operadoras",
      plans: "Planos",
      sources: "Fontes e transparência"
    };
    const views = ["overview", "places", "operators", "plans", "sources"];
    const state = { sources: [], summary: {} };
    const byId = function (id) { return document.getElementById(id); };

    function setText(id, value) {
      const node = byId(id);
      if (node) node.textContent = value == null || value === "" ? "—" : String(value);
    }
    function safeValue(value) {
      return value == null || value === "" ? "—" : String(value);
    }
    function errorBox(message) {
      const box = document.createElement("div");
      box.className = "error";
      box.setAttribute("role", "alert");
      box.textContent = message;
      return box;
    }
    function emptyBox(title, message) {
      const box = document.createElement("div");
      box.className = "empty";
      const strong = document.createElement("strong");
      strong.textContent = title;
      box.appendChild(strong);
      box.appendChild(document.createTextNode(message));
      return box;
    }
    async function api(path) {
      const response = await fetch(path, { headers: { "Accept": "application/json" }, cache: "no-store" });
      if (!response.ok) {
        let detail = "";
        try { const body = await response.json(); detail = body.message || body.error || ""; } catch (_) {}
        throw new Error("A API respondeu HTTP " + response.status + (detail ? ": " + detail : "."));
      }
      return response.json();
    }
    function showApiStatus(ok, label) {
      byId("apiDot").className = "dot " + (ok ? "ok" : "fail");
      setText("apiStatus", label);
    }
    function countLabel(count) {
      if (count === 100) return "100 registros retornados (limite da consulta)";
      return count + (count === 1 ? " registro retornado" : " registros retornados");
    }
    function updateMetric(kind, data, error) {
      if (error) {
        setText(kind + "Count", "—");
        setText(kind + "Note", "Consulta indisponível");
        return;
      }
      const count = Number(data && data.count);
      if (!Number.isFinite(count)) {
        setText(kind + "Count", "—");
        setText(kind + "Note", "A API não informou a quantidade");
        return;
      }
      setText(kind + "Count", String(count));
      setText(kind + "Note", countLabel(count));
    }
    function sourceLabel(status) {
      if (status === "mapping_pending") return "Integração pendente";
      if (status === "implemented") return "Integração implementada";
      if (status === "validated") return "Integração validada";
      return "Estado informado pela API: " + safeValue(status);
    }
    function renderSources(targetId) {
      const target = byId(targetId);
      target.replaceChildren();
      if (!state.sources.length) {
        target.appendChild(emptyBox("Fontes indisponíveis", "A API não retornou a lista de fontes nesta consulta."));
        return;
      }
      state.sources.forEach(function (source) {
        const card = document.createElement("article");
        card.className = "source-card";
        const top = document.createElement("div");
        top.className = "source-top";
        const name = document.createElement("h3");
        name.className = "source-name";
        name.textContent = safeValue(source.name);
        const tag = document.createElement("span");
        tag.className = "status-tag";
        tag.textContent = sourceLabel(source.integration_status);
        top.append(name, tag);
        const id = document.createElement("p");
        id.className = "panel-copy";
        id.textContent = "Identificador: " + safeValue(source.id);
        card.append(top, id);
        if (source.url) {
          const link = document.createElement("a");
          link.className = "source-link";
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Consultar fonte oficial ↗";
          card.appendChild(link);
        }
        target.appendChild(card);
      });
    }
    function makeCell(value, primary) {
      const cell = document.createElement("td");
      if (primary) cell.className = "primary";
      cell.textContent = safeValue(value);
      return cell;
    }
    function renderTable(targetId, rows, columns, emptyTitle, emptyMessage) {
      const target = byId(targetId);
      target.replaceChildren();
      if (!rows.length) {
        target.appendChild(emptyBox(emptyTitle, emptyMessage));
        return;
      }
      const scroll = document.createElement("div");
      scroll.className = "table-scroll";
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      columns.forEach(function (column) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = column.label;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      const tbody = document.createElement("tbody");
      rows.forEach(function (row) {
        const tr = document.createElement("tr");
        columns.forEach(function (column) {
          tr.appendChild(makeCell(typeof column.value === "function" ? column.value(row) : row[column.value], Boolean(column.primary)));
        });
        tbody.appendChild(tr);
      });
      table.append(thead, tbody);
      scroll.appendChild(table);
      target.appendChild(scroll);
    }
    function showCollectionError(metaId, targetId, error) {
      setText(metaId, "Não foi possível concluir a consulta");
      const target = byId(targetId);
      target.replaceChildren(errorBox(error.message || "Falha ao consultar a API."));
    }
    async function loadPlaces(query) {
      setText("placesMeta", "Consultando…");
      const params = new URLSearchParams();
      if (query && query.q) params.set("q", query.q);
      if (query && query.city) params.set("city", query.city);
      if (query && query.state) params.set("state", query.state.toUpperCase());
      try {
        const data = await api("/v1/places" + (params.toString() ? "?" + params.toString() : ""));
        const rows = Array.isArray(data.results) ? data.results : [];
        setText("placesMeta", countLabel(Number(data.count) || rows.length));
        renderTable("placesResults", rows, [
          { label: "Estabelecimento", value: "name", primary: true },
          { label: "CNES", value: "cnes_code" },
          { label: "Cidade / UF", value: function (r) { return [r.city, r.state].filter(Boolean).join(" / "); } },
          { label: "Endereço", value: "address" },
          { label: "Fonte", value: "source" },
          { label: "Atualização da fonte", value: "source_updated_at" }
        ], "Nenhum registro disponível", "A consulta foi concluída, mas a base não retornou estabelecimentos com esses filtros.");
      } catch (error) { showCollectionError("placesMeta", "placesResults", error); }
    }
    async function loadOperators(query) {
      setText("operatorsMeta", "Consultando…");
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      try {
        const data = await api("/v1/operators" + (params.toString() ? "?" + params.toString() : ""));
        const rows = Array.isArray(data.results) ? data.results : [];
        setText("operatorsMeta", countLabel(Number(data.count) || rows.length));
        renderTable("operatorsResults", rows, [
          { label: "Operadora", value: "name", primary: true },
          { label: "Registro ANS", value: "ans_code" },
          { label: "Situação cadastrada", value: "status" },
          { label: "Atualização da fonte", value: "source_updated_at" }
        ], "Nenhuma operadora disponível", "A consulta foi concluída, mas a base não retornou operadoras com esse filtro.");
      } catch (error) { showCollectionError("operatorsMeta", "operatorsResults", error); }
    }
    async function loadPlans(query) {
      setText("plansMeta", "Consultando…");
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      try {
        const data = await api("/v1/plans" + (params.toString() ? "?" + params.toString() : ""));
        const rows = Array.isArray(data.results) ? data.results : [];
        setText("plansMeta", countLabel(Number(data.count) || rows.length));
        renderTable("plansResults", rows, [
          { label: "Produto / plano", value: "name", primary: true },
          { label: "Registro do produto", value: "registration_code" },
          { label: "Operadora associada na base", value: "operator_name" },
          { label: "Situação cadastrada", value: "status" }
        ], "Nenhum produto disponível", "A consulta foi concluída, mas a base não retornou produtos com esse filtro.");
      } catch (error) { showCollectionError("plansMeta", "plansResults", error); }
    }
    async function refreshOverview() {
      showApiStatus(false, "Consultando API…");
      const healthPromise = api("/health");
      const placesPromise = api("/v1/places");
      const operatorsPromise = api("/v1/operators");
      const plansPromise = api("/v1/plans");
      const sourcesPromise = api("/sources");
      const results = await Promise.allSettled([healthPromise, placesPromise, operatorsPromise, plansPromise, sourcesPromise]);
      const health = results[0];
      if (health.status === "fulfilled" && health.value.status === "ok") {
        showApiStatus(true, "API respondendo · v" + safeValue(health.value.version));
      } else {
        showApiStatus(false, "API indisponível");
      }
      updateMetric("places", results[1].status === "fulfilled" ? results[1].value : null, results[1].status === "rejected");
      updateMetric("operators", results[2].status === "fulfilled" ? results[2].value : null, results[2].status === "rejected");
      updateMetric("plans", results[3].status === "fulfilled" ? results[3].value : null, results[3].status === "rejected");
      if (results[4].status === "fulfilled" && Array.isArray(results[4].value.sources)) {
        state.sources = results[4].value.sources;
      } else {
        state.sources = [];
      }
      renderSources("overviewSources");
      renderSources("allSources");
    }
    function navigate(view) {
      if (!views.includes(view)) return;
      views.forEach(function (name) {
        const section = byId(name + "View");
        section.classList.toggle("active", name === view);
      });
      document.querySelectorAll("[data-view]").forEach(function (button) {
        if (button.getAttribute("data-view") === view) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
      setText("viewTitle", titles[view]);
      if (view === "places") loadPlaces({ q: byId("placesQuery").value.trim(), city: byId("placesCity").value.trim(), state: byId("placesState").value.trim() });
      if (view === "operators") loadOperators(byId("operatorsQuery").value.trim());
      if (view === "plans") loadPlans(byId("plansQuery").value.trim());
      if (view === "sources") api("/sources").then(function (data) {
        state.sources = Array.isArray(data.sources) ? data.sources : [];
        renderSources("allSources");
      }).catch(function () {
        byId("allSources").replaceChildren(errorBox("Não foi possível consultar as fontes documentadas na API."));
      });
    }
    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () { navigate(button.getAttribute("data-view")); });
    });
    byId("placesForm").addEventListener("submit", function (event) {
      event.preventDefault();
      loadPlaces({ q: byId("placesQuery").value.trim(), city: byId("placesCity").value.trim(), state: byId("placesState").value.trim() });
    });
    byId("operatorsForm").addEventListener("submit", function (event) {
      event.preventDefault();
      loadOperators(byId("operatorsQuery").value.trim());
    });
    byId("plansForm").addEventListener("submit", function (event) {
      event.preventDefault();
      loadPlans(byId("plansQuery").value.trim());
    });
    byId("refreshAll").addEventListener("click", async function () {
      await refreshOverview();
      const active = document.querySelector(".view.active");
      if (active && active.id === "placesView") loadPlaces({ q: byId("placesQuery").value.trim(), city: byId("placesCity").value.trim(), state: byId("placesState").value.trim() });
      if (active && active.id === "operatorsView") loadOperators(byId("operatorsQuery").value.trim());
      if (active && active.id === "plansView") loadPlans(byId("plansQuery").value.trim());
    });
    refreshOverview();
  </script>
</body>
</html>\`;