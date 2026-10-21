import type { Job } from "bullmq";
import { sendWebhook } from "../alerts/webhook.js";
import type { AlertJobData } from "../alerts/types.js";

export async function processAlert(job: Job<AlertJobData>): Promise<void> {
  const { webhookUrl, provider, event } = job.data;
  await sendWebhook(webhookUrl, provider, event);
}
