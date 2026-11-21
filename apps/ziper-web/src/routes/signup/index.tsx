import { createFileRoute } from '@tanstack/react-router';
import { requireSignedOut, SignupPage } from '../../features/auth';

export const Route = createFileRoute('/signup/')({
  ssr: false,
  beforeLoad: requireSignedOut,
  component: SignupPage,
});
