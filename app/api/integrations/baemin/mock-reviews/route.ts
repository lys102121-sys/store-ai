import { createMockPlatformReviewsResponse } from "@/app/lib/mockPlatformReviews";

const mockReviews = [
  "음식이 따뜻하게 와서 맛있게 먹었어요.",
  "맛은 좋았는데 배달이 조금 늦었어요.",
  "먹고 배가 아팠어요. 음식이 상한 건 아닌지 걱정돼요.",
] as const;

export async function POST(request: Request) {
  return createMockPlatformReviewsResponse(request, {
    platform: "baemin",
    platformName: "배민",
    reviews: mockReviews,
  });
}
