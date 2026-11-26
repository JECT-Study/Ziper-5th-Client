# @ziper/api

백엔드 OpenAPI(`openapi.json`)에서 orval 로 만든 fetcher·TanStack Query 훅·MSW 핸들러입니다. `src/__generated__`는 직접 고치지 않습니다.

```sh
pnpm --filter @ziper/api codegen:fetch         # api.ziper.cc/v3/api-docs 에서 스펙 갱신
pnpm --filter @ziper/api codegen:generate      # 코드 생성
```

- `@ziper/api`: fetcher와 `useXxx`·`getXxxQueryOptions`·`getXxxQueryKey`. 응답은 `{ data, status, headers }`입니다.
- `@ziper/api/schemas`: 요청·응답 타입.
- `@ziper/api/msw`: 테스트용 MSW 핸들러.
- `@ziper/api/http`: 모든 요청이 지나는 mutator. Access Token, 401 재발급, 웹 쿠키 모드, `ApiError`(RFC 7807)를 다룹니다.
- `@ziper/api/product-fields`: 저장·수정 폼이 쓰는 서버 필드 규칙.

`orval/transformer.js`는 스펙의 빈틈(성공 상태 코드, 문자열 enum, 빠진 required, 모호한 operationId)을 생성 전에 메웁니다. 백엔드 스펙이 고쳐지면 해당 항목을 지웁니다.

서버 상태를 바꾸는 요청이 5xx·응답 유실로 끝나면 이미 반영됐을 수 있습니다. `isRejected(error)`가 아니면 서버 상태를 다시 확인하기 전에는 같은 요청을 보내지 않습니다.

구매 완료 전환·목록(JEC-79)은 아직 스펙에 없어 웹의 해당 기능에서 `http`로 직접 부릅니다.
