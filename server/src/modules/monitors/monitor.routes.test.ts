import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeader, buildTestApp, registerAndLogin, type TestApp } from "../../test/helpers.js";

describe("monitor routes", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function createMonitor(token: string, overrides: Record<string, unknown> = {}) {
    return app.inject({
      method: "POST",
      url: "/monitors",
      headers: authHeader(token),
      payload: { name: "API", url: "https://api.example.com/health", ...overrides },
    });
  }

  it("todas as rotas exigem autenticação", async () => {
    const response = await app.inject({ method: "GET", url: "/monitors" });
    expect(response.statusCode).toBe(401);
  });

  describe("POST /monitors", () => {
    it("cria um monitor com os valores padrão do schema", async () => {
      const { token } = await registerAndLogin(app);

      const response = await createMonitor(token);

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({
        name: "API",
        url: "https://api.example.com/health",
        method: "GET",
        intervalSeconds: 60,
        expectedStatus: 200,
        status: "PENDING",
      });
    });

    it("timeout maior ou igual ao intervalo retorna 400", async () => {
      const { token } = await registerAndLogin(app);

      const response = await createMonitor(token, { intervalSeconds: 30, timeoutMs: 30_000 });

      expect(response.statusCode).toBe(400);
      expect(response.json().issues).toContainEqual(
        expect.objectContaining({ path: "timeoutMs" }),
      );
    });

    it("webhookProvider sem webhookUrl retorna 400", async () => {
      const { token } = await registerAndLogin(app);

      const response = await createMonitor(token, { webhookProvider: "DISCORD" });

      expect(response.statusCode).toBe(400);
      expect(response.json().issues).toContainEqual(expect.objectContaining({ path: "webhookUrl" }));
    });
  });

  describe("GET /monitors e /monitors/:id", () => {
    it("lista apenas os monitores do usuário autenticado", async () => {
      const { token: tokenA } = await registerAndLogin(app);
      const { token: tokenB } = await registerAndLogin(app);
      await createMonitor(tokenA, { name: "Monitor A" });
      await createMonitor(tokenB, { name: "Monitor B" });

      const response = await app.inject({ method: "GET", url: "/monitors", headers: authHeader(tokenA) });

      expect(response.statusCode).toBe(200);
      const names = response.json().data.map((m: { name: string }) => m.name);
      expect(names).toEqual(["Monitor A"]);
    });

    it("monitor de outro usuário retorna 404", async () => {
      const { token: tokenA } = await registerAndLogin(app);
      const { token: tokenB } = await registerAndLogin(app);
      const created = await createMonitor(tokenA);
      const monitorId = created.json().data.id;

      const response = await app.inject({
        method: "GET",
        url: `/monitors/${monitorId}`,
        headers: authHeader(tokenB),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("PATCH /monitors/:id", () => {
    it("mudar a url volta o status para PENDING", async () => {
      const { token } = await registerAndLogin(app);
      const created = await createMonitor(token);
      const monitorId = created.json().data.id;

      const response = await app.inject({
        method: "PATCH",
        url: `/monitors/${monitorId}`,
        headers: authHeader(token),
        payload: { url: "https://api.example.com/v2/health" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        url: "https://api.example.com/v2/health",
        status: "PENDING",
      });
    });
  });

  describe("DELETE /monitors/:id", () => {
    it("remove o monitor", async () => {
      const { token } = await registerAndLogin(app);
      const created = await createMonitor(token);
      const monitorId = created.json().data.id;

      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/monitors/${monitorId}`,
        headers: authHeader(token),
      });
      expect(deleteResponse.statusCode).toBe(204);

      const listResponse = await app.inject({ method: "GET", url: "/monitors", headers: authHeader(token) });
      expect(listResponse.json().data).toEqual([]);
    });
  });

  describe("pause/resume", () => {
    it("pausa e retoma um monitor", async () => {
      const { token } = await registerAndLogin(app);
      const created = await createMonitor(token);
      const monitorId = created.json().data.id;

      const paused = await app.inject({
        method: "POST",
        url: `/monitors/${monitorId}/pause`,
        headers: authHeader(token),
      });
      expect(paused.json().data).toMatchObject({ isActive: false, status: "PAUSED" });

      const resumed = await app.inject({
        method: "POST",
        url: `/monitors/${monitorId}/resume`,
        headers: authHeader(token),
      });
      expect(resumed.json().data).toMatchObject({ isActive: true, status: "PENDING" });
    });
  });
});
