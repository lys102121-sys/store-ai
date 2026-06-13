import type { CsReplyPromptStore } from "@/app/lib/prompts/csReplyPrompt";

function getGreeting(store: CsReplyPromptStore) {
  const storeName = store.store_name?.trim();

  return storeName ? `안녕하세요, ${storeName}입니다.` : "안녕하세요.";
}

export function buildProductSafetyReply(store: CsReplyPromptStore) {
  return `${getGreeting(store)} 제품 상태로 많이 걱정되셨을 것 같습니다. 안전을 위해 우선 제품 사용과 충전을 중단해 주세요. 정확한 확인을 위해 상품명과 증상 발생 시점, 현재 상태를 확인할 수 있는 사진이나 영상을 보내주시면 확인 후 안내드리겠습니다.`;
}

export function buildProductSafetyReviewReply() {
  return "불편을 겪으셨다니 걱정되는 마음입니다. 안전을 위해 우선 제품 사용과 충전을 중단해 주세요. 정확한 확인을 위해 주문 정보와 함께 문의 남겨주시면 제품 상태를 확인해 안내드리겠습니다.";
}
