import { createMockPlatformReviewsResponse } from "@/app/lib/mockPlatformReviews";

const mockReviews = [
  "배달도 빠르고 맛있었습니다.",
  "소스가 하나 빠져서 아쉬웠어요.",
  "음식을 먹고 알레르기 반응이 생긴 것 같아요.",
] as const;

export async function POST(request: Request) {
  return createMockPlatformReviewsResponse(request, {
    platform: "coupangeats",
    platformName: "쿠팡이츠",
    reviews: mockReviews,
  });
}
