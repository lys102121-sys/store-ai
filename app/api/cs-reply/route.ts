import OpenAI from "openai";

import { requireAuthenticatedUser } from "@/app/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestBody = {
  customerMessage?: unknown;
  tone?: unknown;
};

type StoreRow = {
  user_id: string | null;
  store_name: string | null;
  tone: string | null;
  shipping_policy: string | null;
  refund_policy: string | null;
  product_name: string | null;
  product_description: string | null;
  product_details: string | null;
  product_caution: string | null;
  extra_faq: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MissingInfoTopic =
  | "gift_wrapping"
  | "allergy"
  | "size_adjustment"
  | "care_instruction"
  | "material"
  | "product_composition"
  | "shipping_fee"
  | "shipping_schedule"
  | "refund_exchange"
  | "general";

function classifyMissingInfoTopic(text: string): MissingInfoTopic {
  if (/선물|포장|선물포장|포장되나요|포장 가능|기프트/.test(text)) {
    return "gift_wrapping";
  }

  if (/알레르기|알러지|피부|금속 알레르기/.test(text)) {
    return "allergy";
  }

  if (/사이즈|조절|크기|호수/.test(text)) {
    return "size_adjustment";
  }

  if (/물|땀|향수|변색|보관|세척/.test(text)) {
    return "care_instruction";
  }

  if (/재질|소재|실버|은|금속/.test(text)) {
    return "material";
  }

  if (/구성|용량|몇 인분|수량/.test(text)) {
    return "product_composition";
  }

  if (/제주|도서산간|배송비|추가 배송비/.test(text)) {
    return "shipping_fee";
  }

  if (/출고|배송일|언제 배송|발송/.test(text)) {
    return "shipping_schedule";
  }

  if (/환불|반품|교환/.test(text)) {
    return "refund_exchange";
  }

  return "general";
}

function hasMissingInfoSignal(reply: string) {
  return [
    "사장님 확인이 필요",
    "등록된 정보에 없어",
    "명시되어 있지 않습니다",
    "정확한 안내를 위해 확인",
    "확인 후 다시 말씀드리겠습니다",
    "확인 후 안내",
    "확인 후 안내드리겠습니다",
    "정확히 확인한 뒤",
    "사장님 확인이 필요합니다",
    "상품 정보가 명시되어 있지 않습니다",
    "상품 정보는 사장님 확인이 필요합니다",
    "해당 상품 정보는 사장님 확인이 필요합니다",
    "해당 내용은 사장님 확인이 필요합니다",
  ].some((signal) => reply.includes(signal));
}

function sanitizeCustomerReply(reply: string) {
  return reply
    .replaceAll(
      "현재 등록된 정보만으로는",
      "정확한 안내를 위해서는",
    )
    .replaceAll("현재 등록된 정보", "현재 확인 가능한 내용")
    .replaceAll("등록된 정보만으로는", "정확한 안내를 위해서는")
    .replaceAll(
      "상품 정보에 명시되어 있지 않습니다",
      "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다",
    )
    .replaceAll(
      "사장님 확인이 필요합니다",
      "확인 후 안내드리겠습니다",
    )
    .replaceAll("저장된 정보", "확인 가능한 내용")
    .replaceAll("시스템", "")
    .replaceAll("AI", "")
    .replaceAll("데이터", "내용")
    .replaceAll("DB", "");
}

function getRegisteredStoreText(store: StoreRow) {
  return [
    store.store_name,
    store.tone,
    store.shipping_policy,
    store.refund_policy,
    store.product_name,
    store.product_description,
    store.product_details,
    store.product_caution,
    store.extra_faq,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n");
}

function isGiftWrapQuestion(message: string) {
  return /선물|포장|기프트/.test(message);
}

function hasGiftWrapInfo(store: StoreRow) {
  return /선물\s*포장|기프트|포장\s*(가능|불가|제공|지원)|포장.*(가능|불가|제공|지원)/.test(
    getRegisteredStoreText(store),
  );
}

function shouldSaveMissingInfo(
  reply: string,
  customerMessage: string,
  store: StoreRow,
) {
  return (
    hasMissingInfoSignal(reply) ||
    (isGiftWrapQuestion(customerMessage) && !hasGiftWrapInfo(store))
  );
}

function buildMissingInfo(customerMessage: string) {
  const normalizedMessage = customerMessage.replace(/\s+/g, " ").trim();

  if (isGiftWrapQuestion(normalizedMessage)) {
    return {
      question: "선물 포장 가능 여부를 알려주세요.",
      reason:
        "고객이 선물 포장 가능 여부를 문의했지만, 현재 등록된 상품 정보에 해당 내용이 없습니다.",
    };
  }

  if (/선물|포장|기프트/.test(normalizedMessage)) {
    return {
      question: "선물 포장 가능 여부를 알려주세요.",
      reason: "선물 포장 문의에 정확히 답변하려면 포장 가능 여부가 필요합니다.",
    };
  }

  if (/알러지|알레르기|알러르기|니켈|금속|주의/.test(normalizedMessage)) {
    return {
      question: "알레르기 관련 주의사항을 등록해주세요.",
      reason:
        "알레르기나 사용 주의사항은 고객 안전과 관련되어 정확한 상품 정보가 필요합니다.",
    };
  }

  if (/사이즈|크기|길이|폭|조절|치수/.test(normalizedMessage)) {
    return {
      question: "상품의 사이즈와 조절 가능 여부를 알려주세요.",
      reason: "상품 크기나 사이즈 조절 문의에 정확히 답변하려면 세부 정보가 필요합니다.",
    };
  }

  if (/재질|소재|성분|원단|도금/.test(normalizedMessage)) {
    return {
      question: "상품의 재질이나 소재 정보를 등록해주세요.",
      reason: "재질이나 소재 문의에 정확히 답변하려면 상품 세부 정보가 필요합니다.",
    };
  }

  if (/보관|사용법|세척|관리/.test(normalizedMessage)) {
    return {
      question: "상품의 보관방법이나 사용법을 등록해주세요.",
      reason: "보관방법이나 사용법 문의에 정확히 답변하려면 주의사항 정보가 필요합니다.",
    };
  }

  if (/배송|출고|도착|택배|제주|도서/.test(normalizedMessage)) {
    return {
      question: "배송 관련 세부 안내를 등록해주세요.",
      reason: "배송 문의에 정확히 답변하려면 배송 정책의 세부 정보가 필요합니다.",
    };
  }

  if (/환불|교환|반품|취소/.test(normalizedMessage)) {
    return {
      question: "환불, 교환, 반품 관련 세부 기준을 등록해주세요.",
      reason: "환불이나 교환 문의에 정확히 답변하려면 정책 기준이 필요합니다.",
    };
  }

  return {
    question: "고객 문의에 답변하기 위해 필요한 정보를 등록해주세요.",
    reason: "등록된 가게, 상품, 정책 정보만으로는 정확한 답변을 만들기 어렵습니다.",
  };
}

function buildSystemPrompt(store: StoreRow): string {
  const name = store.store_name?.trim() || "(가게명 없음)";
  const brandTone = store.tone?.trim() || "(기본 말투 없음)";
  const shipping = store.shipping_policy?.trim() || "(배송 정책 없음)";
  const refund = store.refund_policy?.trim() || "(환불 정책 없음)";

  const productName = store.product_name?.trim() || "(대표 상품명 없음)";
  const productDescription =
    store.product_description?.trim() || "(상품 설명 없음)";
  const productDetails =
    store.product_details?.trim() || "(구성/용량/재질/사이즈 정보 없음)";
  const productCaution =
    store.product_caution?.trim() ||
    "(보관방법/주의사항/알레르기/사용법 정보 없음)";
  const extraFaq = store.extra_faq?.trim() || "(기타 FAQ/포장·옵션 정보 없음)";

  return [
    "[정보 부족 시 절대 단정 금지]",
    "등록된 가게 정보, 배송정책, 환불정책, 상품 정보에 없는 내용은 절대 추측하지 마세요.",
    '"정보 없음"과 "불가능"은 완전히 다릅니다.',
    '가능 여부가 명시되어 있지 않으면 고객에게는 반드시 "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다."처럼 자연스럽게 안내하세요.',
    '정보가 없다는 이유로 "불가능합니다", "제공되지 않습니다", "지원하지 않습니다", "불가합니다"라고 단정하지 마세요.',
    '불가능하다고 답하려면 반드시 등록된 정책이나 상품 정보에 "불가", "제공하지 않음", "불가능" 같은 명시적 근거가 있어야 합니다.',
    "선물 포장, 알레르기, 사이즈, 재질, 보관법, 구성품, 배송 가능 지역 등 상품/정책 정보가 등록되어 있지 않으면 확인 필요로 처리하세요.",
    '고객 답변에는 "현재 등록된 정보", "등록된 정보만으로는", "상품 정보에 명시되어 있지 않습니다", "사장님 확인이 필요합니다", "시스템", "AI", "데이터", "DB", "저장된 정보"를 절대 쓰지 마세요.',
    "고객에게 내부 사정을 설명하지 말고 실제 CS 직원처럼 말하세요.",
    '정보가 부족하면 "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.", "해당 내용은 확인 후 안내드리겠습니다.", "정확히 확인한 뒤 안내드리겠습니다.", "조금 더 정확한 안내를 위해 확인 후 말씀드리겠습니다." 중 자연스러운 표현을 사용하세요.',
    "CS 답변은 고객에게 보여줄 최종 답변만 작성하세요.",
    "반드시 한국어만 사용하세요.",
    "답변은 2~4문장으로 간결하게 작성하세요.",
    '답변 마지막에 "궁금한 점이 있으면 언제든지 문의해 주세요" 같은 일반적인 문장을 반복하지 마세요.',
    "가능하면 고객이 실제로 할 수 있는 다음 행동을 안내하세요.",
    "단, 등록된 가게 정보, 상품 정보, 배송정책, 환불정책에 근거가 있을 때만 행동 안내를 하세요.",
    "행동 안내는 자연스럽고 짧게 작성하세요.",
    "",
    "[정보 부족 답변 예시]",
    '나쁜 예시 - 고객 문의: "선물 포장 가능한가요?" / 등록 정보: 선물 포장 관련 정보 없음 / 답변: "현재 선물 포장은 제공되지 않습니다."',
    "문제: 정보가 없는데 불가능하다고 단정했습니다.",
    '좋은 예시 - 고객 문의: "선물 포장 가능한가요?" / 등록 정보: 선물 포장 관련 정보 없음 / 답변: "안녕하세요, 윤서네 공방입니다. 선물 포장 가능 여부는 정확한 안내를 위해 확인 후 다시 말씀드리겠습니다."',
    "",
    "[근거가 있을 때 다음 행동 안내 예시]",
    '예시 1 - 고객 문의: "선물 포장 가능한가요?" / 등록 정보: "선물 포장 가능합니다. 추가 비용은 1,000원입니다." / 좋은 답변: "안녕하세요, 윤서네 공방입니다. 선물 포장 가능하며, 추가 비용은 1,000원입니다. 주문 시 요청사항에 남겨주시면 확인 후 준비해드리겠습니다."',
    '예시 2 - 고객 문의: "제주도 배송비 얼마예요?" / 등록 정보: "제주/도서산간 지역은 추가 배송비 3,000원이 발생합니다." / 좋은 답변: "안녕하세요, 윤서네 공방입니다. 제주/도서산간 지역은 추가 배송비 3,000원이 발생합니다. 주문 전 참고 부탁드립니다."',
    '예시 3 - 고객 문의: "단순 변심 환불 가능한가요?" / 등록 정보: "단순 변심으로 인한 환불은 불가합니다. 상품 하자가 있는 경우 수령 후 24시간 이내 문의해 주세요." / 좋은 답변: "안녕하세요, 윤서네 공방입니다. 단순 변심으로 인한 환불은 어려운 점 양해 부탁드립니다. 상품 하자가 있는 경우에는 수령 후 24시간 이내 문의해 주시면 확인 후 안내드리겠습니다."',
    "",
    "[대표 상품 정보 - 상품 문의에서 반드시 우선 참고]",
    `대표 상품명: ${productName}`,
    `상품 설명: ${productDescription}`,
    `구성/용량/재질/사이즈 등: ${productDetails}`,
    `보관방법/주의사항/알레르기/사용법 등: ${productCaution}`,
    "",
    "[기타 FAQ/포장·옵션]",
    extraFaq,
    "",
    "상품 관련 질문은 배송정책이나 환불정책보다 대표 상품 정보를 먼저 확인하세요.",
    "선물 포장, 옵션, 기타 자주 묻는 질문은 extra_faq도 반드시 참고하세요.",
    "사이즈, 사이즈 조절, 길이, 폭, 구성, 용량, 재질, 색상, 사용법, 보관방법, 주의사항, 알레르기 질문은 product_details와 product_caution을 최우선으로 참고하세요.",
    'product_details에 "오픈링 형태로 약간의 사이즈 조절이 가능합니다"라는 정보가 있으면, 고객에게 사이즈 조절이 가능하다고 답변하세요.',
    '예: 고객이 "이 반지 사이즈 조절 되나요?"라고 묻고 product_details에 "오픈링 형태로 약간의 사이즈 조절이 가능합니다"가 있으면 "오픈링 형태라 약간의 사이즈 조절이 가능합니다."라고 답변하세요.',
    "대표 상품 정보에 있는 내용을 '명시되어 있지 않습니다'라고 답하지 마세요.",
    '등록된 대표 상품 정보와 정책 어디에도 없는 내용에만 "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다."처럼 안내하세요.',
    "",
    "상품 관련 문의라면 product_name, product_description, product_details, product_caution 정보를 우선 참고하세요.",
    '등록된 상품 정보에 없는 내용은 추측하지 말고 반드시 "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다."처럼 안내하세요.',
    "상품 정보와 정책 정보가 모두 관련된 문의라면 문의에 직접 필요한 내용만 간결하게 반영하세요.",
    "",
    "CS 답변 품질 규칙입니다.",
    "반드시 한국어만 사용하세요.",
    "고객에게 보여줄 최종 답변만 작성하세요.",
    "사장님이 바로 복사해서 사용할 수 있는 자연스러운 한국어로 작성하세요.",
    '"쇼핑하시면서 더 많은 궁금증", "언제든지 문의해 주세요"처럼 문의와 직접 관련이 약한 일반적이고 기계적인 문장은 남발하지 마세요.',
    "고객 문의 내용과 직접 관련 있는 가게 정책을 반드시 반영하세요.",
    "환불 문의라면 refund_policy의 핵심 내용을 함께 반영하세요.",
    "배송 문의라면 shipping_policy의 핵심 내용을 함께 반영하세요.",
    "정책이나 상품 정보에 근거가 있으면 고객의 다음 행동을 짧게 안내하세요.",
    '예: 선물 포장이 가능하면 "주문 시 요청사항에 남겨주시면 확인 후 준비해드리겠습니다.", 제주 추가 배송비가 있으면 "주문 전 참고 부탁드립니다.", 하자 문의 기한이 있으면 "해당 기한 내 문의해 주시면 확인 후 안내드리겠습니다."처럼 작성하세요.',
    "답변은 2~4문장 정도로 간결하게 작성하세요.",
    "가게명이 있으면 첫 문장에 자연스럽게 포함하세요.",
    "이모지는 브랜드 말투나 추가 요청이 밝고 친절한 경우에만 최대 1개 사용하세요.",
    "등록된 정책에 없는 내용은 절대 추측하지 마세요.",
    '모르는 내용은 반드시 "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다."처럼 안내하세요.',
    "",
    "[좋은 답변 예시 1: 환불 문의]",
    '고객 문의: "단순 변심 환불 가능한가요?"',
    '환불정책: "단순 변심으로 인한 환불은 불가합니다. 상품 하자가 있는 경우 수령 후 24시간 이내 문의해 주세요."',
    '좋은 답변: "안녕하세요, 윤서네 공방입니다. 단순 변심으로 인한 환불은 어려운 점 양해 부탁드립니다. 다만 상품에 하자가 있는 경우에는 수령 후 24시간 이내 문의해 주시면 확인 후 도움드리겠습니다. 감사합니다."',
    "",
    "[좋은 답변 예시 2: 배송 문의]",
    '고객 문의: "제주도 배송비 얼마예요?"',
    '배송정책: "제주/도서산간 지역은 추가 배송비 3,000원이 발생합니다."',
    '좋은 답변: "안녕하세요, 윤서네 공방입니다. 제주/도서산간 지역은 추가 배송비 3,000원이 발생합니다. 주문 전 참고 부탁드립니다."',
    "",
    "가장 중요한 작성 규칙입니다. 반드시 지키세요.",
    "고객에게 보여줄 최종 답변만 작성하세요.",
    "반드시 자연스러운 한국어만 사용하세요.",
    "영어, 일본어, 중국어 등 외국어 단어를 섞지 마세요.",
    '"unfortunately", "sorry", "thanks", "please" 같은 영어 표현은 절대 사용하지 마세요.',
    "사장님이 바로 복사해서 사용할 수 있는 자연스러운 한국어로 작성하세요.",
    "환불, 교환, 배송 관련 답변은 등록된 정책을 기준으로 하되 표현은 부드럽게 작성하세요.",
    '예를 들어 "단순 변심으로 인한 환불은 불가능합니다."보다 "단순 변심으로 인한 환불은 어려운 점 양해 부탁드립니다."처럼 안내하세요.',
    '등록된 정책에 없는 내용은 절대 추측하지 말고 "정확한 안내를 위해 확인 후 다시 말씀드리겠습니다."처럼 안내하세요.',
    "",
    "당신은 한국 온라인/오프라인 매장의 고객센터(CS) 담당자입니다.",
    "반드시 한국어로만 답변하세요.",
    "",
    "아래 [가게 정보]에 등록된 가게명·브랜드 말투·배송 정책·환불 정책만 근거로 답변하세요.",
    "정책에 명시되지 않은 배송 일정, 환불 가능 여부, 할인, 재고, 교환 조건 등은 절대 추측하거나 임의로 약속하지 마세요.",
    "해당 내용이 정책에서 확인되지 않으면, 반드시 「정확한 안내를 위해 확인 후 다시 말씀드리겠습니다.」와 같은 표현으로 안내하세요.",
    "정책을 그대로 길게 복붙하지 말고, 문의에 맞게 필요한 부분만 자연스럽게 반영하세요.",
    "과장·허위 약속은 피하고, 정중하고 명확하게 2~5문장 정도로 작성하세요.",
    "",
    "[가게 정보]",
    `가게명: ${name}`,
    `브랜드 말투(기본 톤): ${brandTone}`,
    `배송 정책: ${shipping}`,
    `환불 정책: ${refund}`,
    "",
    "[대표 상품 정보]",
    `대표 상품명: ${productName}`,
    `상품 설명: ${productDescription}`,
    `구성/용량/재질/사이즈 등: ${productDetails}`,
    `보관방법/주의사항/알레르기/사용법 등: ${productCaution}`,
    "",
    "[기타 FAQ/포장·옵션]",
    extraFaq,
  ].join("\n");
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const customerMessage =
    typeof body.customerMessage === "string"
      ? body.customerMessage.trim()
      : "";
  const tone = typeof body.tone === "string" ? body.tone.trim() : "";

  if (!customerMessage || !tone) {
    return Response.json(
      {
        error:
          "Both 'customerMessage' and 'tone' must be non-empty strings.",
      },
      { status: 400 },
    );
  }

  const { data: store, error: storeError } = await auth.supabase
    .from("stores")
    .select(
      "user_id, store_name, tone, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, extra_faq, created_at, updated_at",
    )
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (storeError) {
    return Response.json(
      { error: "Failed to load store.", detail: storeError.message },
      { status: 500 },
    );
  }

  if (!store) {
    return Response.json(
      {
        error:
          "No store found. Save store settings first, then try again.",
      },
      { status: 404 },
    );
  }

  const storeRow = store as StoreRow;
  const systemPrompt = buildSystemPrompt(storeRow);

  try {
    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `고객 문의:\n${customerMessage}\n\n이번 답변에 반영할 말투·요청:\n${tone}\n\n가게 기본 톤과 어긋나지 않게 조화롭게 반영하세요.`,
            },
          ],
        },
      ],
    });

    const rawReply = completion.output_text?.trim();
    const reply = rawReply ? sanitizeCustomerReply(rawReply).trim() : "";

    if (!reply) {
      return Response.json(
        { error: "Failed to generate a CS reply." },
        { status: 502 },
      );
    }

    const { error: csMessageSaveError } = await auth.supabase
      .from("cs_messages")
      .insert({
        user_id: auth.userId,
        customer_message: customerMessage,
        reply,
      });

    if (csMessageSaveError) {
      console.error("Failed to save CS message.", csMessageSaveError);
    }

    if (shouldSaveMissingInfo(reply, customerMessage, storeRow)) {
      const missingInfo = buildMissingInfo(customerMessage);
      const topic = classifyMissingInfoTopic(
        `${customerMessage}\n${missingInfo.question}`,
      );
      const { error: missingInfoSaveError } = await auth.supabase
        .from("missing_infos")
        .insert({
          user_id: auth.userId,
          question: missingInfo.question,
          reason: missingInfo.reason,
          source_message: customerMessage,
          status: "pending",
          topic,
        });

      if (missingInfoSaveError) {
        console.error("Failed to save missing info.", missingInfoSaveError);
      }
    }

    return Response.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OpenAI API error.";

    return Response.json(
      { error: "Failed to call OpenAI API.", detail: message },
      { status: 500 },
    );
  }
}
