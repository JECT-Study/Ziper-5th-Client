import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useIssueEmailVerification, useResendEmailCode, useSignupWithEmail } from '@ziper/api';
import { errorMessage, startSession } from '@ziper/api/http';
import { useState } from 'react';
import * as v from 'valibot';
import { showToast } from '../../../../components';
import { useVerifyEmailCode } from '../../hooks/useVerifyEmailCode';
import { SIGNUP_FLOW } from '../../model/guards';
import {
  EMAIL_CODE_LENGTH,
  emailCodeSchema,
  emailSchema,
  passwordSchema,
  signupPasswordSchema,
} from '../../model/rules';
import { noAgreements } from '../../model/terms';
import { CodeStep } from './steps/CodeStep';
import { EmailStep } from './steps/EmailStep';
import { NicknameStep } from './steps/NicknameStep';
import { PasswordStep } from './steps/PasswordStep';

const FAILED = '요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요';
const STEPS = ['nickname', 'email', 'code', 'password'] as const;
type SignupStep = (typeof STEPS)[number];

/** 이메일 회원가입(RQ-AUTH-13·14): 닉네임 → 이메일 → 인증번호 → 비밀번호·약관. */
export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<SignupStep>('nickname');
  // 인증 메일을 보낼 때 서버가 준 흐름 ID. 인증번호 확인과 가입에 같이 보낸다.
  const [flowId, setFlowId] = useState('');
  const [codeError, setCodeError] = useState<'mismatch' | 'locked' | null>(null);
  const issue = useIssueEmailVerification();
  const resend = useResendEmailCode();
  const verify = useVerifyEmailCode();
  const signup = useSignupWithEmail({
    mutation: { onSuccess: ({ data }) => startSession(data.accessToken) },
  });
  const form = useForm({
    defaultValues: {
      nickname: '',
      email: '',
      code: '',
      password: '',
      passwordConfirm: '',
      agreements: noAgreements,
    },
    onSubmit: async ({ value }) => {
      try {
        await signup.mutateAsync({
          data: {
            flowId,
            nickname: value.nickname,
            password: value.password,
            agreements: {
              termsOfService: true,
              privacyPolicy: true,
              marketing: value.agreements.marketing,
            },
          },
        });
        navigate({ to: '/signup/complete', state: SIGNUP_FLOW });
      } catch (error) {
        // 인증 후 30분이 지나면 서버가 가입을 거절한다.
        showError(error);
      }
    },
  });
  const toLogin = () => navigate({ to: '/login' });
  const showError = (error: unknown) => showToast(errorMessage(error, FAILED));
  const back = () =>
    step === STEPS[0] ? toLogin() : setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);
  const resetCode = () => {
    form.setFieldValue('code', '');
    setCodeError(null);
  };

  async function sendCode() {
    try {
      const { data } = await issue.mutateAsync({ data: { email: form.state.values.email } });
      setFlowId(data.flowId);
      resetCode();
      showToast('인증번호가 발송되었어요');
      setStep('code');
    } catch (error) {
      showError(error);
    }
  }

  async function resendCode() {
    try {
      await resend.mutateAsync({ flowId });
      resetCode();
      showToast('인증번호가 재발송되었어요');
    } catch (error) {
      showError(error);
    }
  }

  async function verifyCode() {
    try {
      const result = await verify.mutateAsync({ flowId, code: form.state.values.code });
      if (result !== 'verified') return setCodeError(result);
      showToast('인증이 완료되었어요');
      setStep('password');
    } catch (error) {
      showError(error);
    }
  }

  switch (step) {
    case 'nickname':
      return (
        <form.Field name="nickname">
          {(field) => (
            <NicknameStep
              nickname={field.state.value}
              onChange={field.handleChange}
              onBack={back}
              onNext={() => setStep('email')}
            />
          )}
        </form.Field>
      );
    case 'email':
      return (
        <form.Field name="email" validators={{ onChange: emailSchema }}>
          {(field) => (
            <EmailStep
              email={field.state.value}
              valid={v.is(emailSchema, field.state.value)}
              error={field.state.meta.errors[0]?.message}
              sending={issue.isPending}
              onChange={(value) => field.handleChange(value.trim())}
              onBack={back}
              onSend={sendCode}
            />
          )}
        </form.Field>
      );
    case 'code':
      return (
        <form.Field name="code">
          {(field) => (
            <CodeStep
              email={form.state.values.email}
              code={field.state.value}
              complete={v.is(emailCodeSchema, field.state.value)}
              error={codeError}
              verifying={verify.isPending}
              onChange={(value) => {
                field.handleChange(value.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH));
                setCodeError(null);
              }}
              onBack={back}
              onVerify={verifyCode}
              onResend={resendCode}
              onRetryEmail={() => setStep('email')}
              onOtherMethod={toLogin}
            />
          )}
        </form.Field>
      );
    case 'password':
      return (
        <form.Subscribe selector={(state) => state.values}>
          {({ password, passwordConfirm, agreements }) => (
            <PasswordStep
              password={password}
              passwordInvalid={password.length > 0 && !v.is(passwordSchema, password)}
              passwordConfirm={passwordConfirm}
              passwordsMatch={passwordConfirm.length > 0 && passwordConfirm === password}
              agreed={agreements}
              canSubmit={v.is(signupPasswordSchema, { password, passwordConfirm, agreements })}
              submitting={signup.isPending}
              onPasswordChange={(value) => form.setFieldValue('password', value)}
              onPasswordConfirmChange={(value) => form.setFieldValue('passwordConfirm', value)}
              onAgreedChange={(value) => form.setFieldValue('agreements', value)}
              onBack={back}
              onSubmit={() => void form.handleSubmit()}
            />
          )}
        </form.Subscribe>
      );
  }
}
