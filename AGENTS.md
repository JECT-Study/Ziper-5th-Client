# AGENTS.md

## API

백엔드 API는 `packages/api`에서 orval로 생성한 코드로만 호출한다.

- `packages/api/src/__generated__`는 생성물이다. 직접 고치지 않고 `pnpm codegen:api`로 다시 만든다.
- 화면은 `@ziper/api`의 생성된 훅(`useXxx`, `useXxxInfinite`, `useXxxSuspense`)과 `getXxxQueryKey`, `getXxxQueryOptions`를 바로 import한다. 이를 감싸는 훅, fetcher, query key 팩토리를 따로 만들지 않는다.
- 직접 만드는 훅은 여러 API를 이어 부르거나 업무 규칙이 필요할 때만 둔다(예: `useSaveProduct`, `useProductLookup`).
- 스펙이 틀리거나 빠진 곳은 화면 코드에서 우회하지 않는다. `packages/api/orval/transformer.js`에서 고친 뒤 다시 생성한다. 백엔드가 스펙을 고치면 그 항목을 지운다.
- 스펙에 아직 없는 API만 `@ziper/api/http`의 `http`로 직접 호출한다. 스펙에 나오면 생성 코드로 바꾼다.
- 인증, 토큰 재발급, 오류(`ApiError`) 처리는 mutator(`packages/api/src/http.ts`) 한 곳에서만 한다.
- 응답은 `{ data, status, headers }` 형태다. 오류 판단은 `ApiError`의 `status`와 `code`로 한다.
- 5xx나 응답 유실로 끝난 mutation은 이미 반영됐을 수 있다. `isRejected`로 서버가 거절한 경우만 다시 보낼 수 있게 한다.
- 테스트는 `@ziper/api/msw`의 생성된 핸들러(`getXxxMockHandler`)로 응답을 흉내 낸다.
- 스펙 갱신: `pnpm --filter @ziper/api codegen`은 `api.ziper.cc/v3/api-docs`에서 스펙을 받아 생성까지 한다.
