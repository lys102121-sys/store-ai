import { createRequire } from "node:module";

import {
  createNormalizedPlatformInquiry,
  type NormalizedPlatformInquiry,
} from "@/app/lib/platformInquiry";

export const SMARTSTORE_OPEN_API_HOST =
  "https://api.commerce.naver.com/external";

export type SmartstoreProductInquiry = NormalizedPlatformInquiry;

type CreateSmartstoreSignatureOptions = {
  clientId: string;
  clientSecret: string;
  timestamp?: number;
};

type RequestSmartstoreAccessTokenOptions = {
  clientId: string;
  clientSecret: string;
  accountId?: string | null;
};

type FetchSmartstoreProductInquiriesOptions = {
  accessToken: string;
  page?: number;
  size?: number;
};

type BcryptModule = {
  hashSync: (password: string, salt: string) => string;
};

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

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "boolean") {
      return String(value);
    }
  }

  return null;
}

function readNestedString(
  record: Record<string, unknown>,
  key: string,
  candidates: string[],
) {
  const nested = record[key];
  if (!isRecord(nested)) return null;

  return readString(nested, candidates);
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
    "contents",
    "content",
    "data",
    "items",
    "inquiries",
    "qnas",
    "questions",
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

function loadBcrypt() {
  const require = createRequire(import.meta.url);

  try {
    return require("bcrypt") as BcryptModule;
  } catch {
    throw new Error(
      "bcrypt package is required for Smartstore OAuth signatures. Install bcrypt before enabling real Smartstore import.",
    );
  }
}

export function createSmartstoreClientSecretSign({
  clientId,
  clientSecret,
  timestamp = Date.now(),
}: CreateSmartstoreSignatureOptions) {
  if (!clientId || !clientSecret || !timestamp) {
    throw new Error("Smartstore OAuth signature parameters are missing.");
  }

  const bcrypt = loadBcrypt();
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);

  if (!hashed) {
    throw new Error("Failed to create Smartstore OAuth signature.");
  }

  return {
    timestamp,
    clientSecretSign: Buffer.from(hashed, "utf8").toString("base64"),
  };
}

export async function requestSmartstoreAccessToken({
  clientId,
  clientSecret,
  accountId,
}: RequestSmartstoreAccessTokenOptions) {
  const { timestamp, clientSecretSign } = createSmartstoreClientSecretSign({
    clientId,
    clientSecret,
  });
  const query = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: clientSecretSign,
    grant_type: "client_credentials",
    type: accountId ? "SELLER" : "SELF",
  });

  if (accountId) {
    query.set("account_id", accountId);
  }

  const response = await fetch(
    `${SMARTSTORE_OPEN_API_HOST}/v1/oauth2/token?${query.toString()}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Smartstore OAuth token request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!isRecord(payload)) {
    throw new Error("Smartstore OAuth token response was not an object.");
  }

  const accessToken = readString(payload, ["access_token", "accessToken"]);
  if (!accessToken) {
    throw new Error("Smartstore OAuth token response did not include access_token.");
  }

  return accessToken;
}

export function createSmartstoreProductInquiryPath() {
  return "/v1/contents/qnas";
}

export function createSmartstoreProductInquiryQuery({
  page = 1,
  size = 20,
}: {
  page?: number;
  size?: number;
} = {}) {
  // 네이버 커머스API 문서 기준 상품 문의 목록 조회는 /v1/contents/qnas 입니다.
  // 문서 UI에서 세부 query parameter가 충분히 노출되지 않아 page/size만 보수적으로 전달합니다.
  return new URLSearchParams({
    page: String(page),
    size: String(size),
  }).toString();
}

export async function fetchSmartstoreProductInquiries({
  accessToken,
  page = 1,
  size = 20,
}: FetchSmartstoreProductInquiriesOptions) {
  const path = createSmartstoreProductInquiryPath();
  const query = createSmartstoreProductInquiryQuery({ page, size });
  const response = await fetch(`${SMARTSTORE_OPEN_API_HOST}${path}?${query}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Smartstore product inquiry request failed: HTTP ${response.status}`,
    );
  }

  return (await response.json()) as unknown;
}

export function parseSmartstoreInquiries(
  payload: unknown,
): SmartstoreProductInquiry[] {
  const rows = findInquiryRows(payload);
  if (!rows) {
    throw new Error("Smartstore inquiry list was not found in the API response.");
  }

  const inquiries = rows
    .flatMap((row) => {
      if (!isRecord(row)) return [];

      const externalId = readString(row, [
        "questionId",
        "inquiryId",
        "inquiryNo",
        "productInquiryNo",
        "id",
      ]);
      const content = readString(row, [
        "question",
        "content",
        "inquiryContent",
        "inquiry",
        "title",
      ]);

      if (!externalId || !content) return [];

      return [
        {
          sourcePlatform: "smartstore" as const,
          externalId,
          content,
          productName:
            readString(row, [
              "productName",
              "productTitle",
              "channelProductName",
              "itemName",
            ]) || readNestedString(row, "product", ["name", "title"]),
          createdAt: readString(row, [
            "createDate",
            "createdAt",
            "createdDate",
            "inquiryAt",
            "registeredAt",
          ]),
          externalUrl: readString(row, ["externalUrl", "url", "inquiryUrl"]),
        },
      ];
    })
    .map(createNormalizedPlatformInquiry);

  if (rows.length > 0 && inquiries.length === 0) {
    throw new Error(
      "Smartstore inquiries could not be parsed from the API response.",
    );
  }

  return inquiries;
}
