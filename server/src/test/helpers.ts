import { buildApp } from "../app.js";

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

export async function buildTestApp(): Promise<TestApp> {
  const app = await buildApp();
  await app.ready();
  return app;
}

type RegisterOverrides = Partial<{ name: string; email: string; password: string }>;

let counter = 0;

/** Registra um usuário novo (e-mail único a cada chamada) e retorna token + dados públicos. */
export async function registerAndLogin(app: TestApp, overrides: RegisterOverrides = {}) {
  counter += 1;
  const payload = {
    name: "Usuário de Teste",
    email: `user-${counter}@example.com`,
    password: "senha12345",
    ...overrides,
  };

  const response = await app.inject({ method: "POST", url: "/auth/register", payload });
  if (response.statusCode !== 201) {
    throw new Error(`Falha ao registrar usuário de teste: ${response.statusCode} ${response.body}`);
  }

  const body = response.json() as { token: string; user: { id: string; email: string } };
  return { token: body.token, user: body.user };
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}
