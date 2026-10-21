-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'HEAD', 'POST');

-- CreateEnum
CREATE TYPE "MonitorStatus" AS ENUM ('PENDING', 'UP', 'DOWN', 'PAUSED');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('DISCORD', 'SLACK');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status_page_slug" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "method" "HttpMethod" NOT NULL DEFAULT 'GET',
    "interval_seconds" INTEGER NOT NULL DEFAULT 60,
    "timeout_ms" INTEGER NOT NULL DEFAULT 10000,
    "expected_status" INTEGER NOT NULL DEFAULT 200,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "webhook_url" VARCHAR(2048),
    "webhook_provider" "WebhookProvider",
    "failure_threshold" INTEGER NOT NULL DEFAULT 2,
    "status" "MonitorStatus" NOT NULL DEFAULT 'PENDING',
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "last_checked_at" TIMESTAMPTZ(3),
    "last_status_change_at" TIMESTAMPTZ(3),
    "last_latency_ms" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_logs" (
    "id" BIGSERIAL NOT NULL,
    "monitor_id" UUID NOT NULL,
    "status" "CheckStatus" NOT NULL,
    "status_code" INTEGER,
    "latency_ms" INTEGER,
    "error" VARCHAR(1024),
    "checked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_status_page_slug_key" ON "users"("status_page_slug");

-- CreateIndex
CREATE INDEX "monitors_user_id_status_idx" ON "monitors"("user_id", "status");

-- CreateIndex
CREATE INDEX "monitors_is_active_idx" ON "monitors"("is_active");

-- CreateIndex
CREATE INDEX "check_logs_monitor_id_checked_at_idx" ON "check_logs"("monitor_id", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "check_logs_monitor_id_status_checked_at_idx" ON "check_logs"("monitor_id", "status", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "check_logs_checked_at_idx" ON "check_logs" USING BRIN ("checked_at");

-- AddForeignKey
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_logs" ADD CONSTRAINT "check_logs_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
