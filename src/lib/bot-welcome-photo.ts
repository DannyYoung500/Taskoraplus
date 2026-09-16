export const BOT_WELCOME_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const BOT_WELCOME_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

export function validateBotWelcomePhoto(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw new Error("Welcome photo must be a JPEG or PNG image.");
  }

  const base64Length = match[2].length;
  const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
  const bytes = Math.floor((base64Length * 3) / 4) - padding;
  if (bytes > BOT_WELCOME_PHOTO_MAX_BYTES) {
    throw new Error("Welcome photo must be 5 MB or smaller.");
  }

  return { contentType: match[1], base64: match[2], bytes };
}
