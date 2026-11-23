import { describe, expect, it } from "vitest";
import app from "../src/index";

const env = { APP_ENV: "test" } as any;

describe("Rede Girassol API", () => {
  it("returns health information", async () => {
    const response = await app.fetch(new Request("https://example.test/health"), env);
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.status).toBe("ok");
    expect(body.service).toBe("Rede Girassol API");
  });

  it("lists official source references", async () => {
    const response = await app.fetch(new Request("https://example.test/sources"), env);
    const body = await response.json() as any;
    expect(response.status).toBe(200);
    expect(body.sources.map((source: any) => source.id)).toEqual(["cnes", "ans"]);
    expect(body.sources[0]).toMatchObject({integration_status: "partial", scope: expect.any(String)});
  });

  it("protects administrative routes when no token is configured", async () => {
    const response = await app.fetch(new Request("https://example.test/admin/imports"), env);
    expect(response.status).toBe(401);
  });


  it("serves the V0.1 dashboard at the root route", async () => {
    const response = await app.fetch(new Request("https://example.test/"), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("Rede Girassol");
    expect(body).toContain("Estabelecimentos");
    expect(body).toContain("Fontes e transparência");
    expect(body).toContain("/v1/places");
  });

  it("does not embed sample fixture records in the dashboard", async () => {
    const response = await app.fetch(new Request("https://example.test/dashboard"), env);
    const body = await response.text();
    expect(body).not.toContain("Estabelecimento Demonstrativo Alfa");
    expect(body).not.toContain("Operadora Demonstrativa Fictícia");
    expect(body).toContain("Nenhum registro disponível");
  });

  it("returns 404 for unknown routes", async () => {
    const response = await app.fetch(new Request("https://example.test/unknown"), env);
    expect(response.status).toBe(404);
  });
});
