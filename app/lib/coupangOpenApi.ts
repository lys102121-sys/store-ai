import { createHmac } from "node:crypto";

export const COUPANG_OPEN_API_HOST = "https://api-gateway.coupang.com";

type CreateCoupangAuthorizationOptions = {
  method: string;
  path: string;
  query: string;
  accessKey: string;
  secretKey: string;
  now?: Date;
};

function createSignedDate(now: Date) {
  const isoDate = now.toISOString();
  return `${isoDate.slice(2, 19).replace(/[:-]/g, "")}Z`;
}

export function createCoupangAuthorization({
  method,
  path,
  query,
  accessKey,
  secretKey,
  now = new Date(),
}: CreateCoupangAuthorizationOptions) {
  if (!method || !path || !accessKey || !secretKey) {
    throw new Error("Coupang HMAC signature parameters are missing.");
  }

  const signedDate = createSignedDate(now);
  // Coupang HMAC docs: signed-date + method + path + query string.
  const message = `${signedDate}${method.toUpperCase()}${path}${query}`;

  let signature: string;
  try {
    signature = createHmac("sha256", secretKey)
      .update(message, "utf8")
      .digest("hex");
  } catch {
    throw new Error("Failed to create Coupang HMAC signature.");
  }

  if (!signature) {
    throw new Error("Failed to create Coupang HMAC signature.");
  }

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;
}
