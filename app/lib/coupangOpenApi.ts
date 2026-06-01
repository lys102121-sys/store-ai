import { createHmac } from "node:crypto";

export const COUPANG_OPEN_API_HOST = "https://api-gateway.coupang.com";

export type CoupangOnlineInquiry = {
  externalId: string;
  content: string;
  productName: string | null;
  createdAt: string | null;
};

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

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function createCoupangOnlineInquiryPath(vendorId: string) {
  return `/v2/providers/openapi/apis/api/v5/vendors/${encodeURIComponent(vendorId)}/onlineInquiries`;
}

export function createCoupangOnlineInquiryReplyPath(
  vendorId: string,
  inquiryId: string,
) {
  // 쿠팡 문서 확인 후 조정 필요: 실제 상품 문의 답변 등록 endpoint를 확인한다.
  return `/v2/providers/openapi/apis/api/v5/vendors/${encodeURIComponent(vendorId)}/onlineInquiries/${encodeURIComponent(inquiryId)}/replies`;
}

export function createCoupangOnlineInquiryReplyBody({
  inquiryId,
  reply,
  wingId,
}: {
  inquiryId: string;
  reply: string;
  wingId: string;
}) {
  const normalizedReply = reply.replace(/\r\n/g, "\n").trim();

  if (!inquiryId || !normalizedReply || !wingId) {
    throw new Error("Coupang inquiry reply parameters are missing.");
  }

  // 쿠팡 문서 확인 후 body field 조정 필요: answer/replyBy 필드명을 확인한다.
  return {
    inquiryId,
    answer: normalizedReply,
    replyBy: wingId,
  };
}

export function createCoupangOnlineInquiryQuery({
  vendorId,
  days = 1,
  pageSize = 50,
  pageNum = 1,
}: {
  vendorId: string;
  days?: number;
  pageSize?: number;
  pageNum?: number;
}) {
  const inquiryEndAt = new Date();
  const inquiryStartAt = new Date(inquiryEndAt);
  inquiryStartAt.setUTCDate(inquiryStartAt.getUTCDate() - days);

  // 쿠팡 문서 확인 후 query parameter 조정 필요
  return new URLSearchParams({
    inquiryStartAt: formatDate(inquiryStartAt),
    inquiryEndAt: formatDate(inquiryEndAt),
    vendorId,
    answeredType: "ALL",
    pageSize: String(pageSize),
    pageNum: String(pageNum),
  }).toString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    const value = record[candidate];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

function findInquiryRows(value: unknown, depth = 0): unknown[] | null {
  if (depth > 4) return null;

  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const key of [
    "content",
    "onlineInquiries",
    "inquiries",
    "items",
    "results",
    "data",
  ]) {
    const rows = findInquiryRows(value[key], depth + 1);
    if (rows) return rows;
  }

  for (const nestedValue of Object.values(value)) {
    const rows = findInquiryRows(nestedValue, depth + 1);
    if (rows) return rows;
  }

  return null;
}

export function parseCoupangOnlineInquiries(
  payload: unknown,
): CoupangOnlineInquiry[] {
  const rows = findInquiryRows(payload);
  if (!rows) {
    throw new Error("Coupang inquiry list was not found in the API response.");
  }

  const inquiries = rows.flatMap((row) => {
    if (!isRecord(row)) return [];

    const externalId = readString(row, [
      "inquiryId",
      "onlineInquiryId",
      "id",
    ]);
    const content = readString(row, [
      "content",
      "inquiry",
      "question",
      "inquiryContent",
    ]);

    if (!externalId || !content) return [];

    return [
      {
        externalId,
        content,
        productName: readString(row, [
          "productName",
          "vendorItemName",
          "itemName",
        ]),
        createdAt: readString(row, [
          "createdAt",
          "inquiryAt",
          "createdDate",
        ]),
      },
    ];
  });

  if (rows.length > 0 && inquiries.length === 0) {
    throw new Error("Coupang inquiries could not be parsed from the API response.");
  }

  return inquiries;
}
