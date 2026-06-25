# Commit And Push Policy

사용자와 합의된 작업 리듬:

1. 작업 완료
2. 검증 실행
3. 커밋
4. 푸시
5. 다음 작업과 다다음 작업 안내
6. 사용자가 "진행하자"라고 하면 가능한 경우 두 작업을 함께 진행

커밋 메시지는 작업 내용에 맞게 작성한다.

예:

```bash
git add .
git commit -m "Add agent harness checklist"
git push
```

주의:

- 커밋 전에 의도하지 않은 파일 변경이 있는지 `git status`로 확인한다.
- 사용자가 만든 변경은 되돌리지 않는다.
- 위험한 삭제 명령은 사용하지 않는다.

