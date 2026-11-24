import { createFileRoute } from '@tanstack/react-router';
import { requireSocialSignup, SocialTermsPage } from '../../features/auth';

export const Route = createFileRoute('/signup/terms')({
  ssr: false,
  beforeLoad: requireSocialSignup,
  component: SocialTermsPage,
});
