import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { isNicknameAvailable, sendEmailCode, signUp, verifyEmailCode } from '../../auth/api';
import {
  EMAIL_CODE_LENGTH,
  EMAIL_CODE_MAX_ATTEMPTS,
  NICKNAME_MAX,
  isValidEmail,
  isValidNickname,
  isValidPassword,
} from '../../auth/rules';
import { StepScreen } from '../../auth/StepScreen';
import { Button, Checkbox, Divider, Modal, TextField, showToast } from '../../components';
import * as styles from '../../styles/signup.css';

export const Route = createFileRoute('/signup/')({
  component: SignupPage,
});

type Step = 'nickname' | 'email' | 'code' | 'password';
const STEPS: Step[] = ['nickname', 'email', 'code', 'password'];

const HEADER_TITLE = '회원 가입';

/** 이메일 회원가입(RQ-AUTH-13·14): 닉네임 → 이메일 → 인증번호 → 비밀번호·약관 */
function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('nickname');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');

  const back = () => {
    const index = STEPS.indexOf(step);
    if (index === 0) navigate({ to: '/login' });
    else setStep(STEPS[index - 1]);
  };

  return (
    <>
      {step === 'nickname' && (
        <NicknameStep
          value={nickname}
          onChange={setNickname}
          onBack={back}
          onNext={() => setStep('email')}
        />
      )}
      {step === 'email' && (
        <EmailStep
          value={email}
          onChange={setEmail}
          onBack={back}
          onSent={() => {
            showToast('인증번호가 발송되었어요');
            setStep('code');
          }}
        />
      )}
      {step === 'code' && (
        <CodeStep
          email={email}
          onBack={back}
          onResent={() => showToast('인증번호가 재발송되었어요')}
          onVerified={() => {
            setStep('password');
          }}
          onRetryEmail={() => setStep('email')}
          onOtherMethod={() => navigate({ to: '/login' })}
        />
      )}
      {step === 'password' && (
        <PasswordStep
          onBack={back}
          onSubmit={async (password, marketingAgreed) => {
            await signUp({ nickname, email, password, marketingAgreed });
            navigate({ to: '/signup/complete' });
          }}
        />
      )}
    </>
  );
}

type NicknameState = 'idle' | 'checking' | 'available' | 'taken';

function NicknameStep({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [state, setState] = useState<NicknameState>('idle');
  const valid = isValidNickname(value);

  // 입력이 멈추면 중복 여부를 확인한다.
  useEffect(() => {
    if (!valid) return setState('idle');
    setState('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const available = await isNicknameAvailable(value);
      if (!cancelled) setState(available ? 'available' : 'taken');
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, valid]);

  const ruleError = value.length > 0 && !valid ? '한글, 영문, 숫자 2~10자로 입력해주세요' : null;
  const error = ruleError ?? (state === 'taken' ? '이미 사용 중인 닉네임입니다' : null);

  return (
    <StepScreen
      headerTitle={HEADER_TITLE}
      onBack={onBack}
      title="닉네임을 입력해주세요"
      description="프로필에 표시되는 이름으로, 언제든 변경할 수 있어요"
      actions={
        <Button disabled={state !== 'available'} onClick={onNext}>
          다음
        </Button>
      }
    >
      <TextField
        label="닉네임"
        placeholder="닉네임을 입력해주세요"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClear={() => onChange('')}
        maxLength={NICKNAME_MAX}
        showCounter
        error={error ?? undefined}
        success={state === 'available'}
        helperText={state === 'available' ? '사용 가능한 닉네임입니다' : undefined}
        autoFocus
      />
    </StepScreen>
  );
}

function EmailStep({
  value,
  onChange,
  onBack,
  onSent,
}: {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const valid = isValidEmail(value);

  async function send() {
    setSending(true);
    try {
      await sendEmailCode(value);
      onSent();
    } finally {
      setSending(false);
    }
  }

  return (
    <StepScreen
      headerTitle={HEADER_TITLE}
      onBack={onBack}
      title="이메일을 입력해주세요"
      actions={
        <Button disabled={!valid} loading={sending} onClick={send}>
          인증 메일 보내기
        </Button>
      }
    >
      <TextField
        label="이메일"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="이메일을 입력해주세요"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        onClear={() => onChange('')}
        error={value.length > 0 && !valid ? '이메일 형식이 올바르지 않습니다' : undefined}
        autoFocus
      />
    </StepScreen>
  );
}

function CodeStep({
  email,
  onBack,
  onResent,
  onVerified,
  onRetryEmail,
  onOtherMethod,
}: {
  email: string;
  onBack: () => void;
  onResent: () => void;
  onVerified: () => void;
  onRetryEmail: () => void;
  onOtherMethod: () => void;
}) {
  const [code, setCode] = useState('');
  const [failures, setFailures] = useState(0);
  const [mismatch, setMismatch] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function verify() {
    setVerifying(true);
    try {
      if (await verifyEmailCode(email, code)) return onVerified();
      setFailures((n) => n + 1);
      setMismatch(true);
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    await sendEmailCode(email);
    setCode('');
    setMismatch(false);
    onResent();
  }

  return (
    <StepScreen
      headerTitle={HEADER_TITLE}
      onBack={onBack}
      eyebrow="아래 주소로 인증코드가 발송되었습니다"
      title={email}
      actionsLayout="stack"
      actions={
        <>
          <Button disabled={code.length !== EMAIL_CODE_LENGTH} loading={verifying} onClick={verify}>
            인증하기
          </Button>
          <Button variant="secondary" onClick={resend}>
            인증번호 재전송
          </Button>
        </>
      }
    >
      <TextField
        label="인증번호"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="인증번호 6자리를 입력해주세요"
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH));
          setMismatch(false);
        }}
        onClear={() => setCode('')}
        error={mismatch ? '인증번호가 일치하지 않습니다' : undefined}
        autoFocus
      />
      <Modal
        open={failures >= EMAIL_CODE_MAX_ATTEMPTS}
        title="인증을 완료하지 못했어요"
        // 닫으면(Escape) 다시 인증하기와 같이 이메일 단계로 돌아간다.
        onClose={onRetryEmail}
        actionsLayout="stack"
        actions={
          <>
            <Button onClick={onOtherMethod}>다른 방법으로 시도하기</Button>
            <Button variant="secondary" onClick={onRetryEmail}>
              다시 인증하기
            </Button>
          </>
        }
      />
    </StepScreen>
  );
}

const TERMS = [
  { id: 'service', label: '[필수] 서비스 이용약관', required: true },
  { id: 'privacy', label: '[필수] 개인정보 수집 및 이용 동의', required: true },
  { id: 'marketing', label: '[선택] 마케팅 정보 수신 동의', required: false },
] as const;

type TermId = (typeof TERMS)[number]['id'];

function PasswordStep({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (password: string, marketingAgreed: boolean) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState<Record<TermId, boolean>>({
    service: false,
    privacy: false,
    marketing: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const passwordValid = isValidPassword(password);
  const matches = confirm.length > 0 && confirm === password;
  const allAgreed = TERMS.every((t) => agreed[t.id]);
  const requiredAgreed = TERMS.every((t) => !t.required || agreed[t.id]);
  const canSubmit = passwordValid && matches && requiredAgreed;

  async function submit() {
    setSubmitting(true);
    try {
      await onSubmit(password, agreed.marketing);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StepScreen
      headerTitle={HEADER_TITLE}
      onBack={onBack}
      title="비밀번호를 입력해주세요"
      actions={
        <Button disabled={!canSubmit} loading={submitting} onClick={submit}>
          다음
        </Button>
      }
    >
      <div className={styles.fields}>
        <TextField
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 입력해주세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText="영문, 숫자, 특수문자 조합 8자리 이상으로 입력해주세요"
          error={password.length > 0 && !passwordValid}
          autoFocus
        />
        <TextField
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력해주세요"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          success={matches}
          helperText={matches ? '비밀번호가 일치합니다' : undefined}
          error={confirm.length > 0 && !matches ? '비밀번호가 일치하지 않습니다' : undefined}
        />
      </div>

      <section className={styles.terms} aria-labelledby="terms-title">
        <p id="terms-title" className={styles.termsTitle}>
          이용약관동의
        </p>
        <Checkbox
          checked={allAgreed}
          onChange={(e) =>
            setAgreed({
              service: e.target.checked,
              privacy: e.target.checked,
              marketing: e.target.checked,
            })
          }
        >
          약관 전체 동의
        </Checkbox>
        <Divider />
        {TERMS.map((term) => (
          <div key={term.id} className={styles.termRow}>
            <Checkbox
              checked={agreed[term.id]}
              onChange={(e) => setAgreed((prev) => ({ ...prev, [term.id]: e.target.checked }))}
            >
              {term.label}
            </Checkbox>
            {/* TODO: 약관 상세(노션 링크)가 정해지면 연결한다. Figma 노트 "개인정보 처리 동의 문구 관련" 참고 */}
            <button type="button" className={styles.termLink}>
              보기
            </button>
          </div>
        ))}
      </section>
    </StepScreen>
  );
}
