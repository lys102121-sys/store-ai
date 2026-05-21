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
  created_at: string | null;
  updated_at: string | null;
};

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

  return [
    "[대표 상품 정보 - 상품 문의에서 반드시 우선 참고]",
    `대표 상품명: ${productName}`,
    `상품 설명: ${productDescription}`,
    `구성/용량/재질/사이즈 등: ${productDetails}`,
    `보관방법/주의사항/알레르기/사용법 등: ${productCaution}`,
    "",
    "상품 관련 질문은 배송정책이나 환불정책보다 대표 상품 정보를 먼저 확인하세요.",
    "사이즈, 사이즈 조절, 길이, 폭, 구성, 용량, 재질, 색상, 사용법, 보관방법, 주의사항, 알레르기 질문은 product_details와 product_caution을 최우선으로 참고하세요.",
    'product_details에 "오픈링 형태로 약간의 사이즈 조절이 가능합니다"라는 정보가 있으면, 고객에게 사이즈 조절이 가능하다고 답변하세요.',
    '예: 고객이 "이 반지 사이즈 조절 되나요?"라고 묻고 product_details에 "오픈링 형태로 약간의 사이즈 조절이 가능합니다"가 있으면 "오픈링 형태라 약간의 사이즈 조절이 가능합니다."라고 답변하세요.',
    "대표 상품 정보에 있는 내용을 '명시되어 있지 않습니다'라고 답하지 마세요.",
    '등록된 대표 상품 정보와 정책 어디에도 없는 내용에만 "해당 상품 정보는 사장님 확인이 필요합니다."라고 안내하세요.',
    "",
    "상품 관련 문의라면 product_name, product_description, product_details, product_caution 정보를 우선 참고하세요.",
    "등록된 상품 정보에 없는 내용은 추측하지 말고 반드시 \"해당 상품 정보는 사장님 확인이 필요합니다.\"라고 안내하세요.",
    "상품 정보와 정책 정보가 모두 관련된 문의라면 문의에 직접 필요한 내용만 간결하게 반영하세요.",
    "",
    "CS 답변 품질 규칙입니다.",
    "반드시 한국어만 사용하세요.",
    "고객에게 보여줄 최종 답변만 작성하세요.",
    "사장님이 바로 복사해서 사용할 수 있는 자연스러운 한국어로 작성하세요.",
    '"쇼핑하시면서 더 많은 궁금증", "언제든지 문의해 주세요"처럼 문의와 직접 관련이 약한 일반적이고 AI스러운 문장은 남발하지 마세요.',
    "고객 문의 내용과 직접 관련 있는 가게 정책을 반드시 반영하세요.",
    "환불 문의라면 refund_policy의 핵심 내용을 함께 반영하세요.",
    "배송 문의라면 shipping_policy의 핵심 내용을 함께 반영하세요.",
    "답변은 2~4문장 정도로 간결하게 작성하세요.",
    "가게명이 있으면 첫 문장에 자연스럽게 포함하세요.",
    "이모지는 브랜드 말투나 추가 요청이 밝고 친절한 경우에만 최대 1개 사용하세요.",
    "등록된 정책에 없는 내용은 절대 추측하지 마세요.",
    '모르는 내용은 반드시 "해당 내용은 사장님 확인이 필요합니다."라고 안내하세요.',
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
    '등록된 정책에 없는 내용은 절대 추측하지 말고 "해당 내용은 사장님 확인이 필요합니다."라고 안내하세요.',
    "",
    "당신은 한국 온라인/오프라인 매장의 고객센터(CS) 담당자입니다.",
    "반드시 한국어로만 답변하세요.",
    "",
    "아래 [가게 정보]에 등록된 가게명·브랜드 말투·배송 정책·환불 정책만 근거로 답변하세요.",
    "정책에 명시되지 않은 배송 일정, 환불 가능 여부, 할인, 재고, 교환 조건 등은 절대 추측하거나 임의로 약속하지 마세요.",
    "해당 내용이 정책에서 확인되지 않으면, 반드시 「해당 내용은 사장님 확인이 필요합니다. 확인 후 다시 안내드리겠습니다.」와 같은 표현으로 안내하세요.",
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
      "user_id, store_name, tone, shipping_policy, refund_policy, product_name, product_description, product_details, product_caution, created_at, updated_at",
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

  const systemPrompt = buildSystemPrompt(store as StoreRow);

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

    const reply = completion.output_text?.trim();

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
