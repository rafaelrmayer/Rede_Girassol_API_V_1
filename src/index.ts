import { importPlaces } from "./import";
import { DASHBOARD_HTML } from "./dashboard";

export interface Env {
  DB: D1Database;
  IMPORT_TOKEN?: string;
  APP_ENV?: string;
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
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,authorization"
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

    if (request.method === "GET" && path === "/sources") {
      return json({
        sources: [
          { id: "cnes", name: "Cadastro Nacional de Estabelecimentos de Saúde", url: "https://dadosabertos.saude.gov.br/dataset/cnes-cadastro-nacional-de-estabelecimentos-de-saude", integration_status: "mapping_pending" },
          { id: "ans", name: "Agência Nacional de Saúde Suplementar", url: "https://www.gov.br/ans/pt-br/acesso-a-informacao/perfil-do-setor/dados-abertos-1", integration_status: "mapping_pending" }
        ]
      });
    }

    if (path.startsWith("/admin/")) {
      if (!authorized(request, env)) return json({ error: "unauthorized", message: "Token administrativo ausente ou inválido." }, 401);
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

    if (request.method === "GET" && path === "/v1/places") {
      const q = (url.searchParams.get("q") ?? "").trim();
      const city = (url.searchParams.get("city") ?? "").trim();
      const state = (url.searchParams.get("state") ?? "").trim().toUpperCase();
      let stmt = "SELECT id, cnes_code, name, city, state, address, source, source_updated_at FROM establishments WHERE 1=1";
      const params: string[] = [];
      if (q) { stmt += " AND name LIKE ?"; params.push(`%${q}%`); }
      if (city) { stmt += " AND city LIKE ?"; params.push(`%${city}%`); }
      if (state) { stmt += " AND state = ?"; params.push(state); }
      stmt += " ORDER BY name LIMIT 100";
      const result = await env.DB.prepare(stmt).bind(...params).all();
      return json({ results: result.results ?? [], count: result.results?.length ?? 0, note: "A consulta reflete somente os dados presentes na base." });
    }

    const placeMatch = path.match(/^\/v1\/places\/([^/]+)$/);
    if (request.method === "GET" && placeMatch) {
      const result = await env.DB.prepare("SELECT * FROM establishments WHERE id = ? OR cnes_code = ? LIMIT 1").bind(placeMatch[1], placeMatch[1]).first();
      return result ? json({ result }) : json({ error: "not_found" }, 404);
    }

    if (request.method === "GET" && path === "/v1/operators") {
      const q = (url.searchParams.get("q") ?? "").trim();
      const result = await env.DB.prepare(
        "SELECT id, ans_code, name, status, source_updated_at FROM operators WHERE name LIKE ? ORDER BY name LIMIT 100"
      ).bind(`%${q}%`).all();
      return json({ results: result.results ?? [], count: result.results?.length ?? 0 });
    }

    if (request.method === "GET" && path === "/v1/plans") {
      const q = (url.searchParams.get("q") ?? "").trim();
      const result = await env.DB.prepare(
        "SELECT p.id, p.name, p.registration_code, p.status, o.name AS operator_name FROM products p LEFT JOIN operators o ON o.id = p.operator_id WHERE p.name LIKE ? ORDER BY p.name LIMIT 100"
      ).bind(`%${q}%`).all();
      return json({ results: result.results ?? [], count: result.results?.length ?? 0, note: "A presença de um produto não comprova rede credenciada atual." });
    }

    return json({ error: "not_found", path }, 404);
  }
};
