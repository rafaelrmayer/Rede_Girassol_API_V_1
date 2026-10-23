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
  });

  it("protects administrative routes when no token is configured", async () => {
    const response = await app.fetch(new Request("https://example.test/admin/imports"), env);
    expect(response.status).toBe(401);
  });

  it("returns 404 for unknown routes", async () => {
    const response = await app.fetch(new Request("https://example.test/unknown"), env);
    expect(response.status).toBe(404);
  });
});
