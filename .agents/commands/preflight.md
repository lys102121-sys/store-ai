# Preflight Checklist

작업 전에 반드시 이 순서로 확인한다.

1. `AGENTS.md`를 확인한다.
2. `.agents/project/context.md`를 확인한다.
3. `.agents/project/status.md`에서 이미 진행된 작업인지 확인한다.
4. 관련 키워드로 코드 검색을 한다.
   - 예: `rg -n "smartstore|coupang|missing_info|store-knowledge|correction" app scripts`
5. 이미 구현된 기능이면 중복 구현하지 않는다.
6. 일부만 구현된 기능이면 기존 흐름을 재사용해 보강한다.
7. 새 파일을 만들기 전에 기존 파일/유틸/스크립트를 먼저 찾는다.
8. 작업이 끝나면 status 문서가 바뀌어야 하는지 판단한다.

