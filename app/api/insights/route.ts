import OpenAI from "openai";

import { requireAuthenticatedUser } from "@/app/lib/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ReviewRow = {
  review: string;
  sentiment: string | null;
};

function formatReviewsForPrompt(reviews: ReviewRow[]): string {
  return reviews
    .map(
      (row, index) =>
        `${index + 1}. [sentiment: ${row.sentiment ?? "unknown"}] ${row.review}`,
    )
    .join("\n");
}

export async function GET(request: Request) {
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

  const { data, error } = await auth.supabase
    .from("reviews")
    .select("review, sentiment")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return Response.json(
      { error: "Failed to fetch reviews.", detail: error.message },
      { status: 500 },
    );
  }

  const reviews = (data ?? []) as ReviewRow[];

  if (reviews.length === 0) {
    return Response.json(
      { error: "No reviews found. Add reviews before generating insights." },
      { status: 404 },
    );
  }

  try {
    const completion = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [
            "당신은 소상공인 매장을 돕는 운영 데이터 분석가입니다.",
            "제공된 최근 고객 리뷰와 sentiment(positive/neutral/negative)만 근거로 한국어 운영 인사이트를 작성하세요.",
            "",
            "반드시 아래 세 섹션을 포함하세요 (## 제목 사용):",
            "## 고객 불만 요약",
            "## 자주 언급되는 장점",
            "## 개선 추천",
            "",
            "- 리뷰에 근거 없는 내용은 쓰지 마세요.",
            "- bullet(-)로 읽기 쉽게 정리하세요.",
            "- 실행 가능한 제안 위주로 간결하게 작성하세요.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `최근 리뷰 ${reviews.length}건:\n\n${formatReviewsForPrompt(reviews)}`,
            },
          ],
        },
      ],
    });

    const insights = completion.output_text?.trim();

    if (!insights) {
      return Response.json(
        { error: "Failed to generate insights." },
        { status: 502 },
      );
    }

    return Response.json({ insights });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OpenAI API error.";

    return Response.json(
      { error: "Failed to call OpenAI API.", detail: message },
      { status: 500 },
    );
  }
}
