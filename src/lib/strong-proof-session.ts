/**
 * Session-bound proof tokens — one-time tokens bound to user + task + short TTL.
 * Prevents screenshot/proof replay across accounts or delayed resubmits.
 */
import { createHash, randomBytes } from "node:crypto";

const TTL_MS = 15 * 60 * 1000; // 15 minutes

export function mintProofSessionToken(userId: string, taskId: string): {
  token: string;
  expiresAt: string;
} {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const material = `${userId}|${taskId}|${nonce}|${expiresAt}`;
  const token = createHash("sha256").update(material).digest("hex").slice(0, 32);
  return { token, expiresAt };
}

export function assertProofSessionToken(opts: {
  token: string | null | undefined;
  expectedToken: string | null | undefined;
  expiresAt: string | null | undefined;
}): void {
  if (!opts.expectedToken || !opts.expiresAt) {
    throw new Error("Proof session is not ready. Re-open the task and try again.");
  }
  if (!opts.token || opts.token !== opts.expectedToken) {
    throw new Error("Invalid or expired proof session. Re-open the task and submit again.");
  }
  if (new Date(opts.expiresAt).getTime() < Date.now()) {
    throw new Error("Proof session expired. Re-open the task and submit again.");
  }
}
