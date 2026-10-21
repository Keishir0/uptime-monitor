import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../lib/errors.js";

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: "VALIDATION_ERROR",
      message: "Dados inválidos",
      issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      ...(error.issues.length > 0 && { issues: error.issues }),
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return reply.status(409).send({ error: "CONFLICT", message: "Registro duplicado" });
    }
    if (error.code === "P2025") {
      return reply.status(404).send({ error: "NOT_FOUND", message: "Recurso não encontrado" });
    }
  }

  // Erros do próprio Fastify/plugins (JSON malformado, rate limit, etc.)
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({ error: error.code ?? "REQUEST_ERROR", message: error.message });
  }

  request.log.error({ err: error }, "Erro não tratado");
  return reply.status(500).send({ error: "INTERNAL_ERROR", message: "Erro interno do servidor" });
}
