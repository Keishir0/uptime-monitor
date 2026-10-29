import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authHeader, buildTestApp, registerAndLogin, type TestApp } from "../../test/helpers.js";

describe("public routes", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("slug inexistente retorna 404", async () => {
    const response = await app.inject({ method: "GET", url: "/public/status/nao-existe" });
    expect(response.statusCode).toBe(404);
  });

  it("só retorna monitores públicos, sem campos sensíveis", async () => {
    const { token } = await registerAndLogin(app, { name: "Dona da Página" });
    await app.inject({
      method: "PATCH",
      url: "/auth/me",
      headers: authHeader(token),
      payload: { statusPageSlug: "pagina-publica" },
    });
    await app.inject({
      method: "POST",
      url: "/monitors",
      headers: authHeader(token),
      payload: { name: "Monitor Público", url: "https://public.example.com", isPublic: true },
    });
    await app.inject({
      method: "POST",
      url: "/monitors",
      headers: authHeader(token),
      payload: { name: "Monitor Privado", url: "https://private.example.com", isPublic: false },
    });

    const response = await app.inject({ method: "GET", url: "/public/status/pagina-publica" });

    expect(response.statusCode).toBe(200);
    const { data } = response.json();
    expect(data.name).toBe("Dona da Página");
    expect(data.monitors).toHaveLength(1);
    expect(data.monitors[0]).toMatchObject({ name: "Monitor Público" });
    expect(data.monitors[0].url).toBeUndefined();
  });
});
