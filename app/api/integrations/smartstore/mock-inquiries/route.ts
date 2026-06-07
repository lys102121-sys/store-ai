import { createMockPlatformInquiriesResponse } from "@/app/lib/mockPlatformInquiries";

const mockInquiries = [
  "오늘 주문하면 언제 출고되나요?",
  "선물 포장이나 쇼핑백 같이 받을 수 있나요?",
  "이 상품 재고 있나요?",
] as const;

export async function POST(request: Request) {
  return createMockPlatformInquiriesResponse(request, {
    platform: "smartstore",
    platformName: "스마트스토어",
    inquiries: mockInquiries,
  });
}
