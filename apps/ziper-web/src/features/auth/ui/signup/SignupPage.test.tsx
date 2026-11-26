// @vitest-environment happy-dom
import {
  getCheckNicknameAvailabilityMockHandler,
  getIssueEmailVerificationMockHandler,
  getVerifyEmailCodeMockHandler,
} from '@ziper/api/msw';
import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { server } from '../../../../test/server';
import { button, click, field, render, type } from '../../../../test/dom';
import { SignupPage } from './SignupPage';

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../../../components', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../components')>()),
  showToast: vi.fn(),
}));

async function toEmailStep() {
  server.use(getCheckNicknameAvailabilityMockHandler({ available: true }));
  const container = await render(<SignupPage />);
  await type('닉네임', '집퍼');
  await vi.waitFor(() => expect(button('다음').disabled).toBe(false), { timeout: 2_000 });
  await click('다음');
  return container;
}

it('blocks an invalid nickname without asking the server', async () => {
  const container = await render(<SignupPage />);
  await type('닉네임', '집퍼!');
  expect(container.textContent).toContain('한글, 영문, 숫자 2~10자로 입력해주세요');
  expect(button('다음').disabled).toBe(true);
});

it('blocks an invalid email, then sends the code and sanitizes it', async () => {
  server.use(getIssueEmailVerificationMockHandler({ flowId: 'flow' }));
  const container = await toEmailStep();
  await type('이메일', 'nope');
  expect(container.textContent).toContain('이메일 형식이 올바르지 않습니다');
  expect(button('인증 메일 보내기').disabled).toBe(true);
  await type('이메일', 'me@example.com ');
  expect(field('이메일').value).toBe('me@example.com');
  await click('인증 메일 보내기');
  await vi.waitFor(() => expect(field('인증번호')).toBeTruthy());
  await type('인증번호', '12a3-4567');
  expect(field('인증번호').value).toBe('123456');
  expect(button('인증하기').disabled).toBe(false);
});

it('requires a valid matching password and the required terms', async () => {
  server.use(
    getIssueEmailVerificationMockHandler({ flowId: 'flow' }),
    getVerifyEmailCodeMockHandler(),
  );
  await toEmailStep();
  await type('이메일', 'me@example.com');
  await click('인증 메일 보내기');
  await vi.waitFor(() => expect(field('인증번호')).toBeTruthy());
  await type('인증번호', '123456');
  await click('인증하기');
  await vi.waitFor(() => expect(field('비밀번호')).toBeTruthy());
  await type('비밀번호', 'short1!');
  expect(button('다음').disabled).toBe(true);
  await type('비밀번호', 'password1!');
  await type('비밀번호 확인', 'password1?');
  expect(document.body.textContent).toContain('비밀번호가 일치하지 않습니다');
  await type('비밀번호 확인', 'password1!');
  expect(button('다음').disabled).toBe(true);
  const all = [...document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')][0];
  await act(async () => all.click());
  expect(button('다음').disabled).toBe(false);
});
