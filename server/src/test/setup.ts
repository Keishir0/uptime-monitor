import { afterAll, afterEach } from "vitest";
import { prisma } from "../lib/prisma.js";
import { alertQueue, checkQueue, maintenanceQueue } from "../queues/queues.js";

afterEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "check_logs", "monitors", "users" RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await Promise.all([checkQueue.close(), alertQueue.close(), maintenanceQueue.close()]);
  await prisma.$disconnect();
});
