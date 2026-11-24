import { createFileRoute } from '@tanstack/react-router';
import { EmailLoginPage, requireSignedOut } from '../../features/auth';

export const Route = createFileRoute('/login/email')({
  ssr: false,
  beforeLoad: requireSignedOut,
  component: EmailLoginPage,
});
