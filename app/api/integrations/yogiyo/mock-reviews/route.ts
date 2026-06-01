import { createMockPlatformReviewsResponse } from "@/app/lib/mockPlatformReviews";

const mockReviews = [
  "포장이 깔끔하고 양도 넉넉했어요.",
  "요청사항을 남겼는데 반영이 안 된 것 같아요.",
  "먹고 두드러기가 올라왔어요.",
] as const;

export async function POST(request: Request) {
  return createMockPlatformReviewsResponse(request, {
    platform: "yogiyo",
    platformName: "요기요",
    reviews: mockReviews,
  });
}
