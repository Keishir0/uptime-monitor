import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp, authHeader, registerAndLogin, type TestApp } from "../../test/helpers.js";

describe("auth routes", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /auth/register", () => {
    it("cria a conta e retorna token + usuário sem a senha", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { name: "Ana Silva", email: "ana@example.com", password: "senha12345" },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.token).toEqual(expect.any(String));
      expect(body.user).toMatchObject({ name: "Ana Silva", email: "ana@example.com" });
      expect(body.user.passwordHash).toBeUndefined();
    });

    it("e-mail duplicado retorna 409", async () => {
      await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { name: "Bia", email: "duplicado@example.com", password: "senha12345" },
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { name: "Bia 2", email: "duplicado@example.com", password: "outrasenha" },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe("CONFLICT");
    });

    it("senha curta retorna 400 de validação", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: { name: "Carla", email: "carla@example.com", password: "123" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /auth/login", () => {
    it("credenciais corretas retornam token", async () => {
      await registerAndLogin(app, { email: "login-ok@example.com", password: "senha12345" });

      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "login-ok@example.com", password: "senha12345" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().token).toEqual(expect.any(String));
    });

    it("senha errada retorna 401", async () => {
      await registerAndLogin(app, { email: "login-senha-errada@example.com", password: "senha12345" });

      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "login-senha-errada@example.com", password: "senhaerrada" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe("UNAUTHORIZED");
    });

    it("e-mail inexistente retorna 401 (mesma mensagem da senha errada)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "nao-existe@example.com", password: "qualquer123" },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe("UNAUTHORIZED");
    });
  });

  describe("GET /auth/me", () => {
    it("sem token retorna 401", async () => {
      const response = await app.inject({ method: "GET", url: "/auth/me" });
      expect(response.statusCode).toBe(401);
    });

    it("com token retorna os dados do usuário", async () => {
      const { token, user } = await registerAndLogin(app, { email: "me@example.com" });

      const response = await app.inject({ method: "GET", url: "/auth/me", headers: authHeader(token) });

      expect(response.statusCode).toBe(200);
      expect(response.json().user).toMatchObject({ id: user.id, email: "me@example.com" });
    });
  });

  describe("PATCH /auth/me", () => {
    it("atualiza nome e slug da página pública", async () => {
      const { token } = await registerAndLogin(app, { email: "patch@example.com" });

      const response = await app.inject({
        method: "PATCH",
        url: "/auth/me",
        headers: authHeader(token),
        payload: { name: "Novo Nome", statusPageSlug: "meu-status" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().user).toMatchObject({ name: "Novo Nome", statusPageSlug: "meu-status" });
    });

    it("slug já usado por outro usuário retorna 409", async () => {
      await registerAndLogin(app, { email: "dono-do-slug@example.com" });
      const { token: donoToken } = await registerAndLogin(app, { email: "dono-slug-2@example.com" });
      await app.inject({
        method: "PATCH",
        url: "/auth/me",
        headers: authHeader(donoToken),
        payload: { statusPageSlug: "slug-ocupado" },
      });

      const { token: outroToken } = await registerAndLogin(app, { email: "quer-o-slug@example.com" });
      const response = await app.inject({
        method: "PATCH",
        url: "/auth/me",
        headers: authHeader(outroToken),
        payload: { statusPageSlug: "slug-ocupado" },
      });

      expect(response.statusCode).toBe(409);
    });
  });
});
