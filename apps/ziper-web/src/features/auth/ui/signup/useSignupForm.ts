import { useState } from 'react';
import { resendEmailCode, sendEmailCode, signUp, verifyEmailCode } from '../../api/authApi';
import { useAgreements } from '../../hooks/useAgreements';
import { EMAIL_CODE_LENGTH, isValidEmail, isValidPassword } from '../../model/rules';

export type SignupStep = 'nickname' | 'email' | 'code' | 'password';

const STEPS: SignupStep[] = ['nickname', 'email', 'code', 'password'];

/**
 * 이메일 회원가입 폼 전체 상태(RQ-AUTH-13·14). 단계가 이어지고 값끼리 엮여 있어서 폼 단위로 한곳에서 관리한다.
 * API 를 부르는 함수는 실패하면 그대로 던진다. 토스트와 화면 이동은 쓰는 쪽이 정한다.
 */
export function useSignupForm() {
  const [step, setStep] = useState<SignupStep>('nickname');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  // 인증 메일을 보낼 때 서버가 준 흐름 ID. 인증번호 확인과 가입에 같이 보낸다.
  const [flowId, setFlowId] = useState('');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<'mismatch' | 'locked' | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const { agreed, setAgreed, requiredAgreed } = useAgreements();
  const [pending, setPending] = useState<'send' | 'verify' | 'submit' | null>(null);

  async function whilePending<T>(kind: 'send' | 'verify' | 'submit', run: () => Promise<T>) {
    setPending(kind);
    try {
      return await run();
    } finally {
      setPending(null);
    }
  }

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
    sendingCode: pending === 'send',
    sendCode: () =>
      whilePending('send', async () => {
        setFlowId(await sendEmailCode(email));
        setCode('');
        setCodeError(null);
      }),

    code,
    // 숫자만, 6자리까지만 받는다.
    setCode: (value: string) => {
      setCode(value.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH));
      setCodeError(null);
    },
    codeComplete: code.length === EMAIL_CODE_LENGTH,
    codeError,
    verifyingCode: pending === 'verify',
    /** 맞으면 true. 틀리거나 잠기면 codeError 에 남기고 false. */
    verifyCode: () =>
      whilePending('verify', async () => {
        const result = await verifyEmailCode(flowId, code);
        if (result !== 'verified') setCodeError(result);
        return result === 'verified';
      }),
    resendCode: async () => {
      await resendEmailCode(flowId);
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
    submitting: pending === 'submit',
    submit: () =>
      whilePending('submit', () =>
        signUp({ flowId, nickname, password, marketingAgreed: agreed.marketing }),
      ),
  };
}
