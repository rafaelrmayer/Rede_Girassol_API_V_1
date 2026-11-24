import {plansState,importAnsPlans,listAnsPlans} from './ans-plans';
import {ansState,importAnsOperators,listAnsOperators} from './ans-operators';
import { withContacts } from './contacts';
import { supportGuide } from './support-guide';
import { listAutismSupport } from './autism-support';
import { listRehabilitation } from './rehabilitation';
import rehabilitationCatalog from '../rehabilitation-classifications.json';
import openapi from "../openapi.json";
import { DOCS_HTML } from "./docs";
import { pagination, readPage } from "./pagination";
import { importPlaces } from "./import";
import { DASHBOARD_HTML } from "./dashboard";

export interface Env {
  DB: D1Database;
  IMPORT_TOKEN?: string;
  RAPIDAPI_PROXY_SECRET?: string;
  APP_ENV?: string;
  ANS_PLANS_DAILY_RECORD_LIMIT?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization"
    }
  });

function authorized(request: Request, env: Env): boolean {
  const token = env.IMPORT_TOKEN;
  if (!token) return false;
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let path = url.pathname;
    if (path === "/rapidapi" || path.startsWith("/rapidapi/")) {
      const target = path.slice("/rapidapi".length);
      const allowed = ["/health", "/sources", "/v1/places", "/v1/autism-support", "/v1/rehabilitation", "/v1/support-guide", "/v1/operators", "/v1/plans"].includes(target)
        || /^\/v1\/places\/[^/]+$/.test(target);
      if (!allowed) return json({error: "not_found"}, 404);
      if (request.method !== "GET") return json({error: "method_not_allowed"}, 405);
      if (!env.RAPIDAPI_PROXY_SECRET?.trim()) return json({error: "gateway_not_configured"}, 503);
      if (request.headers.get("x-rapidapi-proxy-secret") !== env.RAPIDAPI_PROXY_SECRET)
        return json({error: "gateway_unauthorized"}, 403);
      path = target;
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,authorization"
      }});
    }

    if (request.method === "GET" && path === "/openapi.json") return json(openapi);

    if (request.method === "GET" && (path === "/docs" || path === "/docs/")) {
      return new Response(DOCS_HTML, {headers: {
        "content-type": "text/html; charset=utf-8", "cache-control": "no-store",
        "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
      }});
    }

    if (request.method === "GET" && (path === "/" || path === "/dashboard")) {
      return new Response(DASHBOARD_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "referrer-policy": "no-referrer",
          "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"
        }
      });
    }

    if (request.method === "GET" && path === "/health") {
      return json({ status: "ok", service: "Rede Girassol API", version: "0.1.0", environment: env.APP_ENV ?? "unknown" });
    }

    if (request.method === "GET" && path === "/v1/support-guide") {
      if (url.search) return json({error: "unsupported_parameters", message: "Esta rota não recebe perguntas nem dados pessoais. A pesquisa é feita no navegador."}, 400);
      return json(supportGuide());
    }

    if (request.method === "GET" && path === "/sources") {
      const ans=await ansState(env.DB);const ansSnapshot=(ans.body as any).snapshot;
      const plans=await plansState(env.DB);const plansSnapshot=(plans.body as any).snapshot;
      return json({
        sources: [
          { id: "cnes", name: "Cadastro Nacional de Estabelecimentos de Saúde", url: "https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude", integration_status: "partial", scope: "Carga manual e limitada de estabelecimentos; cobertura nacional e atualização automática ainda não implementadas." },
          { id: "cnes-services", name: "CNES – Serviços especializados de reabilitação", url: rehabilitationCatalog.source_url, integration_status: "partial", scope: "Observações mensais do serviço 135; atendimento específico a TEA não verificado." },
          { id: "autism-support", name: "Atendimento a TEA documentado em fontes oficiais", url: "https://www.curitiba.pr.gov.br/noticias/prefeito-lanca-programa-para-quadruplicar-atendimento-a-criancas-autistas-ate-o-fim-do-ano/82418", integration_status: "partial", scope: "Curadoria manual com fonte, público, datas e prazo de revisão; não confirma vagas nem cobertura completa." },
          { id: "ans", name: "Agência Nacional de Saúde Suplementar", url: "https://www.gov.br/ans/pt-br/acesso-a-informacao/perfil-do-setor/dados-abertos-1", integration_status: ansSnapshot ? "partial" : "mapping_pending",
            operators_ready: !!ansSnapshot, plans_ready: !!plansSnapshot, plans_source_date: plansSnapshot?.source_date ?? null, plans_count: plansSnapshot?.record_count ?? null, active_source_date: ansSnapshot?.active_source_date ?? null, cancelled_source_date: ansSnapshot?.cancelled_source_date ?? null,
            scope: plansSnapshot ? "Operadoras e características cadastrais nacionais de planos conforme arquivos ANS importados. A sede não é cobertura; rede credenciada e municípios de abrangência não integrados." : ansSnapshot ? "Operadoras ativas e canceladas conforme arquivos importados; município/UF são da sede. Planos aguardam carga nacional validada; rede credenciada não integrada." : "Aguardando a primeira carga completa de operadoras ANS; planos e rede credenciada pendentes." }
        ]
      });
    }

    if (path.startsWith("/admin/")) {
      if (!authorized(request, env)) return json({ error: "unauthorized", message: "Token administrativo ausente ou inválido." }, 401);
      if (request.method === "GET" && path === "/admin/ans/plans/state") {const result=await plansState(env.DB);return json(result.body,result.status);}
      const planAction=path.match(/^\/admin\/ans\/plans\/(begin|chunk|commit)$/);
      if (request.method === "POST" && planAction) {
        const configured=env.ANS_PLANS_DAILY_RECORD_LIMIT??'';
        const dailyLimit=/^\d+$/.test(configured) && Number(configured)>=250 && Number(configured)<=250000 ? Number(configured) : 15000;
        const result=await importAnsPlans(request,env.DB,planAction[1],dailyLimit);
        return json(result.body,result.status);
      }
      if (request.method === "GET" && path === "/admin/ans/operators/state") {const result=await ansState(env.DB);return json(result.body,result.status);}
      if (request.method === "POST" && path === "/admin/ans/operators/snapshot") {const result=await importAnsOperators(request,env.DB);return json(result.body,result.status);}
      if (request.method === "POST" && path === "/admin/import") {
        const result = await importPlaces(request, env.DB);
        return json(result.body, result.status);
      }
      if (request.method === "GET" && path === "/admin/imports") {
        const result = await env.DB.prepare("SELECT * FROM import_runs ORDER BY started_at DESC LIMIT 100").all();
        return json({ imports: result.results ?? [] });
      }
      return json({ error: "not_found" }, 404);
    }

    if (request.method === "GET" && path === "/v1/autism-support") {
      const result = await listAutismSupport(url.searchParams, env.DB);
      return json(result.body, result.status);
    }

    if (request.method === "GET" && path === "/v1/rehabilitation") {
      const result = await listRehabilitation(url.searchParams, env.DB);
      return json(result.body, result.status);
    }

    if (request.method === "GET" && path === "/v1/places") {
      const page = pagination(url.searchParams);
      if (!page) return json({error: "invalid_pagination", message: "Use limit inteiro de 1 a 100 e offset inteiro não negativo, sem repetir parâmetros."}, 400);
      const q = (url.searchParams.get("q") ?? "").trim();
      const city = (url.searchParams.get("city") ?? "").trim();
      const state = (url.searchParams.get("state") ?? "").trim().toUpperCase();
      let stmt = "SELECT id, cnes_code, name, city, state, address, source, source_updated_at FROM establishments WHERE 1=1";
      const params: string[] = [];
      if (q) { stmt += " AND name LIKE ?"; params.push(`%${q}%`); }
      if (city) { stmt += " AND city LIKE ?"; params.push(`%${city}%`); }
      if (state) { stmt += " AND state = ?"; params.push(state); }
      const count = "SELECT COUNT(*) AS total" + stmt.slice(stmt.indexOf(" FROM"));
      const result = await readPage(env.DB, stmt, count, " ORDER BY name, id", params, page,
        "A consulta reflete somente os dados presentes na base.");
      return json({...result, results: result.results.map(withContacts)});
    }

    const placeMatch = path.match(/^\/v1\/places\/([^/]+)$/);
    if (request.method === "GET" && placeMatch) {
      const result = await env.DB.prepare("SELECT * FROM establishments WHERE id = ? OR cnes_code = ? LIMIT 1").bind(placeMatch[1], placeMatch[1]).first();
      return result ? json({ result: withContacts(result) }) : json({ error: "not_found" }, 404);
    }

    if (request.method === "GET" && path === "/v1/operators") {
      const result=await listAnsOperators(url.searchParams,env.DB);return json(result.body,result.status);
    }

    if (request.method === "GET" && path === "/v1/plans") {
      const result=await listAnsPlans(url.searchParams,env.DB);return json(result.body,result.status);
    }

    return json({ error: "not_found", path }, 404);
  }
};
