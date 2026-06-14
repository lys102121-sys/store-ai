export type PlatformSource =
  | "manual"
  | "smartstore"
  | "coupang"
  | "baemin"
  | "yogiyo"
  | "coupangeats";

export type NormalizedPlatformInquiry = {
  sourcePlatform: PlatformSource;
  externalId: string;
  content: string;
  productName: string | null;
  createdAt: string | null;
  externalUrl: string | null;
};

export function createNormalizedPlatformInquiry(
  inquiry: NormalizedPlatformInquiry,
): NormalizedPlatformInquiry {
  const sourcePlatform = inquiry.sourcePlatform.trim() as PlatformSource;
  const externalId = inquiry.externalId.trim();
  const content = inquiry.content.trim();

  if (!sourcePlatform || !externalId || !content) {
    throw new Error("Platform inquiry identifiers and content are required.");
  }

  return {
    sourcePlatform,
    externalId,
    content,
    productName: inquiry.productName?.trim() || null,
    createdAt: inquiry.createdAt?.trim() || null,
    externalUrl: inquiry.externalUrl?.trim() || null,
  } satisfies NormalizedPlatformInquiry;
}

export function buildPlatformInquiryKnowledgeText(
  inquiry: Pick<NormalizedPlatformInquiry, "productName" | "content">,
) {
  return [inquiry.productName, inquiry.content]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");
}

export function buildPlatformInquiryPromptContext(
  inquiry: Pick<
    NormalizedPlatformInquiry,
    "sourcePlatform" | "productName"
  >,
) {
  return [
    inquiry.productName ? `문의 상품명: ${inquiry.productName}` : null,
    `문의 출처: ${inquiry.sourcePlatform}`,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

export function isMockPlatformInquiry(
  inquiry: Pick<NormalizedPlatformInquiry, "externalId">,
) {
  return inquiry.externalId.startsWith("mock-");
}
