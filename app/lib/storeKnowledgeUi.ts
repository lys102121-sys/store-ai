import { semanticBadgeClass } from "@/app/lib/workflowUi";

export type StoreKnowledgeStatus = "active" | "needs_review" | "archived";
export type StoreKnowledgeStatusFilter =
  | "all"
  | "active"
  | "needs_review"
  | "archived";

export function storeKnowledgeCategoryLabel(value?: string | null) {
  switch (value) {
    case "product_catalog":
      return "상품 목록";
    case "pricing":
      return "가격";
    case "shipping":
      return "배송/출고";
    case "refund_exchange":
      return "환불/교환";
    case "stock":
      return "재고";
    case "reservation":
      return "예약/픽업";
    case "packaging":
      return "포장";
    case "allergy_ingredient":
      return "알레르기/성분";
    case "product":
      return "상품 정보";
    default:
      return "기타 FAQ";
  }
}

export function normalizeStoreKnowledgeStatus(
  value?: string | null,
): StoreKnowledgeStatus {
  if (value === "needs_review" || value === "archived") return value;

  return "active";
}

export function storeKnowledgeStatusLabel(value?: string | null) {
  switch (normalizeStoreKnowledgeStatus(value)) {
    case "needs_review":
      return "검토 필요";
    case "archived":
      return "보관됨";
    default:
      return "답변 사용 중";
  }
}

export function storeKnowledgeStatusBadgeClass(value?: string | null) {
  switch (normalizeStoreKnowledgeStatus(value)) {
    case "needs_review":
      return semanticBadgeClass("warning");
    case "archived":
      return semanticBadgeClass("neutral");
    default:
      return semanticBadgeClass("success");
  }
}
