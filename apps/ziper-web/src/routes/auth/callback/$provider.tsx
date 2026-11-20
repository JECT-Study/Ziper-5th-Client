import { createFileRoute } from '@tanstack/react-router';
import { OAuthCallbackPage } from '../../../features/auth';

export const Route = createFileRoute('/auth/callback/$provider')({
  // 코드 교환은 브라우저에서만 한다.
  ssr: false,
  component: function OAuthCallbackRoute() {
    const { provider } = Route.useParams();
    return <OAuthCallbackPage provider={provider} />;
  },
});
