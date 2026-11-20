import { createFileRoute } from '@tanstack/react-router';
import { requireSignupFlow, SignupCompletePage } from '../../features/auth';

export const Route = createFileRoute('/signup/complete')({
  ssr: false,
  beforeLoad: requireSignupFlow,
  component: SignupCompletePage,
});
