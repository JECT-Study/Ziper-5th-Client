import { createFileRoute } from '@tanstack/react-router';
import { requireSignedOut, LoginPage } from '../../features/auth';

export const Route = createFileRoute('/login/')({
  ssr: false,
  beforeLoad: requireSignedOut,
  component: LoginPage,
});
