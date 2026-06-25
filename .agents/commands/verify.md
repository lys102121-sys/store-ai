# Verification Commands

기본 검증:

```bash
npm run test:harness
npm run test:cs-guard
npx tsc --noEmit
npm run lint
npm run build
```

관련 작업별 추가 검증:

```bash
npm run test:learning
npm run test:workflow-safety
npm run test:monetization
npm run test:store-knowledge-quality
npm run test:store-knowledge-usage
```

규칙:

- CS 답변, 안전 가드, 플랫폼 문의 처리와 관련된 작업은 항상 `test:cs-guard`를 포함한다.
- 학습, missing info, 수정 답변 학습, 가게 지식 작업은 `test:learning`, `test:store-knowledge-quality`, `test:store-knowledge-usage`를 함께 고려한다.
- 유료 체험, 결제, 도입 상담, 플랜 게이트 작업은 `test:monetization`을 포함한다.
- AI CS 처리함 UI/상태 작업은 `test:workflow-safety`를 포함한다.
- `next build`가 Google Fonts 네트워크 제한으로 실패하면 네트워크 허용 상태로 재실행해 실제 빌드를 확인한다.

