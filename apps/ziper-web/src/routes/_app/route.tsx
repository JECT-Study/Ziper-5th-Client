import { createFileRoute } from '@tanstack/react-router';
import { requireSignedIn } from '../../features/auth';

export const Route = createFileRoute('/_app')({
  // 세션은 브라우저에서만 확인할 수 있다(쿠키 재발급).
  ssr: false,
  beforeLoad: requireSignedIn,
});
