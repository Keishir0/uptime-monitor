import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * O BullMQ exige `maxRetriesPerRequest: null` para conexões usadas por workers
 * (comandos bloqueantes não podem falhar por limite de retry).
 */
export function createRedisConnection(connectionName: string): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, connectionName });
}
