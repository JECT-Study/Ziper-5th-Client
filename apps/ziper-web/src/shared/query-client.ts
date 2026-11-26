import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/http';

/**
 * 서버 상태(보드 목록 등)를 캐시하는 TanStack Query 클라이언트.
 * 서버에서는 요청마다, 브라우저에서는 한 번 만든다(router.tsx 의 getRouter). 모듈에 하나만 두면 서버에서 사용자끼리 캐시가 섞인다.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // staleTime 0: 화면에 다시 오면 캐시를 바로 보여주고 뒤에서 새로 받는다(스켈레톤 없이).
        // 상품 수정·구매 완료처럼 다른 화면에서 바뀐 내용도 돌아오면 반영된다.
        staleTime: 0,
        // 4xx 는 다시 보내도 같은 결과라 재시도하지 않는다. 네트워크·5xx 만 한 번 더 시도한다.
        retry: (failureCount, error) =>
          failureCount < 1 && !(error instanceof ApiError && error.status < 500),
      },
      mutations: { retry: false },
    },
  });
}
