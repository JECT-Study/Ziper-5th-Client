import { useIssueEmailVerification, useResendEmailCode, useSignupWithEmail } from '@ziper/api';
import { startSession } from '@ziper/api/http';
import { useState } from 'react';
import { useAgreements } from '../../hooks/useAgreements';
import { useVerifyEmailCode } from '../../hooks/useVerifyEmailCode';
import { EMAIL_CODE_LENGTH, isValidEmail, isValidPassword } from '../../model/rules';

export type SignupStep = 'nickname' | 'email' | 'code' | 'password';

const STEPS: SignupStep[] = ['nickname', 'email', 'code', 'password'];

/** 이메일 회원가입 폼 상태(RQ-AUTH-13·14). API 실패는 그대로 던지고, 알림과 이동은 쓰는 쪽이 정한다. */
export function useSignupForm() {
  const [step, setStep] = useState<SignupStep>('nickname');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [flowId, setFlowId] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<'mismatch' | 'locked' | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const { agreed, setAgreed, requiredAgreed } = useAgreements();
  const issue = useIssueEmailVerification();
  const resend = useResendEmailCode();
  const verify = useVerifyEmailCode();
  const signup = useSignupWithEmail({
    mutation: { onSuccess: ({ data }) => startSession(data.accessToken) },
  });

  const passwordValid = isValidPassword(password);
  const passwordsMatch = passwordConfirm.length > 0 && passwordConfirm === password;

  return {
    step,
    isFirstStep: step === STEPS[0],
    goTo: setStep,
    goBack: () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]),

    nickname,
    setNickname,

    email,
    setEmail: (value: string) => setEmail(value.trim()),
    emailValid: isValidEmail(email),
    sendingCode: issue.isPending,
    sendCode: async () => {
      const { data } = await issue.mutateAsync({ data: { email } });
      setFlowId(data.flowId);
      setCode('');
      setCodeError(null);
    },

    code,
    setCode: (value: string) => {
      setCode(value.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH));
      setCodeError(null);
    },
    codeComplete: code.length === EMAIL_CODE_LENGTH,
    codeError,
    verifyingCode: verify.isPending,
    /** 맞으면 true. 틀리거나 잠기면 codeError 에 남기고 false. */
    verifyCode: async () => {
      const result = await verify.mutateAsync({ flowId, code });
      if (result !== 'verified') setCodeError(result);
      return result === 'verified';
    },
    resendCode: async () => {
      await resend.mutateAsync({ flowId });
      setCode('');
      setCodeError(null);
    },

    password,
    setPassword,
    passwordInvalid: password.length > 0 && !passwordValid,
    passwordConfirm,
    setPasswordConfirm,
    passwordsMatch,
    agreed,
    setAgreed,
    canSubmit: passwordValid && passwordsMatch && requiredAgreed,
    submitting: signup.isPending,
    submit: () =>
      signup.mutateAsync({
        data: {
          flowId,
          nickname,
          password,
          agreements: { termsOfService: true, privacyPolicy: true, marketing: agreed.marketing },
        },
      }),
  };
}
