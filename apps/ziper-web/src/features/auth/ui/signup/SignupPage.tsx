import { useNavigate } from '@tanstack/react-router';
import { showToast } from '../../../../components';
import { errorMessage } from '../../../../shared/api/http';
import { SIGNUP_FLOW } from '../../model/guards';
import { CodeStep } from './steps/CodeStep';
import { EmailStep } from './steps/EmailStep';
import { NicknameStep } from './steps/NicknameStep';
import { PasswordStep } from './steps/PasswordStep';
import { useSignupForm } from './useSignupForm';

const FAILED = '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요';

/** 이메일 회원가입: 닉네임 → 이메일 → 인증번호 → 비밀번호·약관. 단계 이동과 알림은 여기서만 한다. */
export function SignupPage() {
  const navigate = useNavigate();
  const form = useSignupForm();
  const toLogin = () => navigate({ to: '/login' });
  const showError = (error: unknown) => showToast(errorMessage(error, FAILED));

  function back() {
    if (form.isFirstStep) toLogin();
    else form.goBack();
  }

  async function sendCode() {
    try {
      await form.sendCode();
      showToast('인증번호가 발송되었어요');
      form.goTo('code');
    } catch (error) {
      showError(error);
    }
  }

  async function resendCode() {
    try {
      await form.resendCode();
      showToast('인증번호가 재발송되었어요');
    } catch (error) {
      showError(error);
    }
  }

  async function verifyCode() {
    try {
      if (await form.verifyCode()) form.goTo('password');
    } catch (error) {
      showError(error);
    }
  }

  async function submit() {
    try {
      await form.submit();
      navigate({ to: '/signup/complete', state: SIGNUP_FLOW });
    } catch (error) {
      // 인증 후 30분이 지나면 서버가 가입을 거절한다.
      showError(error);
    }
  }

  switch (form.step) {
    case 'nickname':
      return (
        <NicknameStep
          nickname={form.nickname}
          onChange={form.setNickname}
          onBack={back}
          onNext={() => form.goTo('email')}
        />
      );
    case 'email':
      return (
        <EmailStep
          email={form.email}
          valid={form.emailValid}
          sending={form.sendingCode}
          onChange={form.setEmail}
          onBack={back}
          onSend={sendCode}
        />
      );
    case 'code':
      return (
        <CodeStep
          email={form.email}
          code={form.code}
          complete={form.codeComplete}
          error={form.codeError}
          verifying={form.verifyingCode}
          onChange={form.setCode}
          onBack={back}
          onVerify={verifyCode}
          onResend={resendCode}
          onRetryEmail={() => form.goTo('email')}
          onOtherMethod={toLogin}
        />
      );
    case 'password':
      return (
        <PasswordStep
          password={form.password}
          passwordInvalid={form.passwordInvalid}
          passwordConfirm={form.passwordConfirm}
          passwordsMatch={form.passwordsMatch}
          agreed={form.agreed}
          canSubmit={form.canSubmit}
          submitting={form.submitting}
          onPasswordChange={form.setPassword}
          onPasswordConfirmChange={form.setPasswordConfirm}
          onAgreedChange={form.setAgreed}
          onBack={back}
          onSubmit={submit}
        />
      );
  }
}
