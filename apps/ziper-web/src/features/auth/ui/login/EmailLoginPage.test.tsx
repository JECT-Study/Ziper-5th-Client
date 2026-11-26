// @vitest-environment happy-dom
import { getLoginWithEmailMockHandler } from '@ziper/api/msw';
import { getAccessToken, startSession } from '@ziper/api/http';
import { HttpResponse, http } from 'msw';
import { afterEach, expect, it, vi } from 'vitest';
import { server } from '../../../../test/server';
import { button, click, render, type } from '../../../../test/dom';
import { EmailLoginPage } from './EmailLoginPage';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../../../../components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../components')>()),
  showToast: vi.fn(),
}));
afterEach(() => {
  navigate.mockClear();
  startSession(null);
});

it('enables login only for a valid email and a password, trimming the email', async () => {
  await render(<EmailLoginPage />);
  expect(button('로그인').disabled).toBe(true);
  await type('이메일', 'not-an-email');
  await type('비밀번호', 'secret');
  expect(button('로그인').disabled).toBe(true);
  await type('이메일', ' me@example.com ');
  expect(button('로그인').disabled).toBe(false);
});

it('submits, starts the session and goes home', async () => {
  let body: unknown;
  server.use(
    getLoginWithEmailMockHandler(async ({ request }) => {
      body = await request.json();
      return { accessToken: 'token' };
    }),
  );
  await render(<EmailLoginPage />);
  await type('이메일', 'me@example.com');
  await type('비밀번호', 'secret');
  await click('로그인');
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/', replace: true }));
  expect(body).toEqual({ email: 'me@example.com', password: 'secret' });
  expect(getAccessToken()).toBe('token');
});

it.each([
  [401, '비밀번호가 올바르지 않아요.'],
  [429, '30분 후 다시 시도해 주세요.'],
])('shows the %i failure under the password', async (status, message) => {
  server.use(http.post('*/api/v1/auth/email/login', () => HttpResponse.json({}, { status })));
  const container = await render(<EmailLoginPage />);
  await type('이메일', 'me@example.com');
  await type('비밀번호', 'wrong');
  await click('로그인');
  await vi.waitFor(() => expect(container.textContent).toContain(message));
  expect(navigate).not.toHaveBeenCalled();
});
