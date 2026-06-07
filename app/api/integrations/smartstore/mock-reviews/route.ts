import { createMockPlatformReviewsResponse } from "@/app/lib/mockPlatformReviews";

const mockReviews = [
  "배송 빠르고 상품도 사진이랑 같아요.",
  "포장이 조금 찌그러져서 왔지만 상품은 괜찮았습니다.",
  "사용 후 피부가 붉어지고 가려웠어요.",
] as const;

export async function POST(request: Request) {
  return createMockPlatformReviewsResponse(request, {
    platform: "smartstore",
    platformName: "스마트스토어",
    reviews: mockReviews,
  });
}
