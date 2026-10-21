import type { FastifyRequest } from "fastify";
import { unauthorized } from "../lib/errors.js";

/** preHandler para rotas privadas: valida o Bearer token e popula request.user. */
export async function requireAuth(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized("Token ausente, inválido ou expirado");
  }
}
