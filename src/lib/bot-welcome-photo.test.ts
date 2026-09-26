import test from "node:test";
import assert from "node:assert/strict";
import { validateBotWelcomePhoto } from "./bot-welcome-photo";

test("accepts a small JPEG data URL", () => {
  const result = validateBotWelcomePhoto("data:image/jpeg;base64,SGVsbG8=");
  assert.equal(result.contentType, "image/jpeg");
  assert.equal(result.bytes, 5);
});

test("rejects unsupported image types", () => {
  assert.throws(
    () => validateBotWelcomePhoto("data:image/webp;base64,SGVsbG8="),
    /JPEG or PNG/,
  );
});

test("rejects images over 5 MB", () => {
  const oversized = "A".repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3));
  assert.throws(
    () => validateBotWelcomePhoto(`data:image/png;base64,${oversized}`),
    /5 MB or smaller/,
  );
});
