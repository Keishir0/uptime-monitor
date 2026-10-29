import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { requireAuth } from "../../http/auth-guard.js";
import { loginSchema, registerSchema, updateProfileSchema } from "./auth.schemas.js";
import { authenticateUser, getUserById, registerUser, updateProfile } from "./auth.service.js";

// Limite mais agressivo nas rotas públicas de credenciais (força bruta).
// Desligado em teste: os testes de rota criam várias contas por arquivo.
const credentialsRateLimit = {
  rateLimit: env.NODE_ENV === "test" ? false : { max: 10, timeWindow: "1 minute" },
};

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", { config: credentialsRateLimit }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await registerUser(input);
    const token = await reply.jwtSign({ sub: user.id });
    return reply.status(201).send({ token, user });
  });

  app.post("/login", { config: credentialsRateLimit }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await authenticateUser(input);
    const token = await reply.jwtSign({ sub: user.id });
    return reply.send({ token, user });
  });

  app.get("/me", { preHandler: requireAuth }, async (request) => {
    return { user: await getUserById(request.user.sub) };
  });

  app.patch("/me", { preHandler: requireAuth }, async (request) => {
    const input = updateProfileSchema.parse(request.body);
    return { user: await updateProfile(request.user.sub, input) };
  });
}
