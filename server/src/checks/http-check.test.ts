import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { performHttpCheck, type HttpCheckTarget } from "./http-check.js";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/ok") return res.writeHead(200).end("ok");
    if (req.url === "/created") return res.writeHead(201).end();
    if (req.url === "/error") return res.writeHead(503).end("indisponível");
    if (req.url === "/redirect") return res.writeHead(302, { location: "/ok" }).end();
    if (req.url === "/slow") return void setTimeout(() => res.writeHead(200).end(), 2_000);
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const target = (path: string, overrides: Partial<HttpCheckTarget> = {}): HttpCheckTarget => ({
  url: `${baseUrl}${path}`,
  method: "GET",
  timeoutMs: 1_000,
  expectedStatus: 200,
  ...overrides,
});

describe("performHttpCheck", () => {
  it("UP quando o status bate com o esperado, medindo a latência", async () => {
    const result = await performHttpCheck(target("/ok"));
    expect(result).toMatchObject({ status: "UP", statusCode: 200, error: null });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("respeita expectedStatus diferente de 200", async () => {
    expect(await performHttpCheck(target("/created", { expectedStatus: 201 }))).toMatchObject({ status: "UP" });
  });

  it("segue redirects", async () => {
    expect(await performHttpCheck(target("/redirect", { method: "HEAD" }))).toMatchObject({
      status: "UP",
      statusCode: 200,
    });
  });

  it("DOWN com status inesperado", async () => {
    expect(await performHttpCheck(target("/error"))).toMatchObject({
      status: "DOWN",
      statusCode: 503,
      error: "HTTP 503 (esperado 200)",
    });
  });

  it("DOWN por timeout", async () => {
    expect(await performHttpCheck(target("/slow", { timeoutMs: 200 }))).toEqual({
      status: "DOWN",
      statusCode: null,
      latencyMs: null,
      error: "Timeout após 200ms",
    });
  });

  it("DOWN quando a conexão é recusada", async () => {
    // Reserva uma porta livre e a libera: ninguém mais escuta nela.
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const { port } = probe.address() as AddressInfo;
    await new Promise((resolve) => probe.close(resolve));

    const result = await performHttpCheck({ ...target(""), url: `http://127.0.0.1:${port}/` });
    expect(result.status).toBe("DOWN");
    expect(result.error).toMatch(/^ECONNREFUSED/);
  });

  it("DOWN quando o domínio não existe", async () => {
    const result = await performHttpCheck({ ...target(""), url: "http://dominio-inexistente.invalid/" });
    expect(result).toMatchObject({ status: "DOWN", statusCode: null });
    expect(result.error).toMatch(/^(ENOTFOUND|EAI_AGAIN)/);
  });

  it("descreve erros sem código usando a mensagem da causa", async () => {
    // Porta 1 está na lista de "bad ports" do fetch: falha antes de conectar.
    const result = await performHttpCheck({ ...target(""), url: "http://127.0.0.1:1/" });
    expect(result).toMatchObject({ status: "DOWN", error: "bad port" });
  });
});
