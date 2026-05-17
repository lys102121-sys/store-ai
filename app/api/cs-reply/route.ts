import OpenAI from "openai";

import { getSupabase } from "@/app/lib/supabase";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestBody = {
  customerMessage?: unknown;
  tone?: unknown;
};

type StoreRow = {
  store_name: string | null;
  tone: string | null;
  shipping_policy: string | null;
  refund_policy: string | null;
};

function buildSystemPrompt(store: StoreRow): string {
  const name = store.store_name?.trim() || "(가게명 없음)";
  const brandTone = store.tone?.trim() || "(기본 말투 없음)";
  const shipping = store.shipping_policy?.trim() || "(배송 정책 없음)";
  const refund = store.refund_policy?.trim() || "(환불 정책 없음)";

  return [
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
  ].join("\n");
}

export async function POST(request: Request) {
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

  let supabase: ReturnType<typeof getSupabase>;

  try {
    supabase = getSupabase();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase configuration error.";
    return Response.json(
      { error: "Supabase is not configured.", detail: message },
      { status: 500 },
    );
  }

  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("store_name, tone, shipping_policy, refund_policy")
    .order("id", { ascending: false })
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

    const { error: csMessageSaveError } = await supabase
      .from("cs_messages")
      .insert({
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
