import { createFileRoute } from '@tanstack/react-router';
import { requireSignupFlow, SocialTermsPage } from '../../features/auth';

export const Route = createFileRoute('/signup/terms')({
  ssr: false,
  beforeLoad: requireSignupFlow,
  component: SocialTermsPage,
});
