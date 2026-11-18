import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { signInWithEmail } from '../../auth/api';
import { isValidEmail } from '../../auth/rules';
import { StepScreen } from '../../auth/StepScreen';
import { Button, TextField } from '../../components';
import * as styles from '../../styles/signup.css';

export const Route = createFileRoute('/login/email')({
  component: EmailLoginPage,
});

/** 이메일 로그인(RQ-AUTH-16) */
function EmailLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
      navigate({ to: '/' }); // TODO: 홈 화면이 생기면 경로를 맞춘다.
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <StepScreen
      onBack={() => navigate({ to: '/login' })}
      title="로그인"
      description="가입한 이메일과 비밀번호를 입력해 주세요."
      actions={
        <Button
          disabled={!isValidEmail(email) || password.length === 0}
          loading={submitting}
          onClick={submit}
        >
          로그인
        </Button>
      }
    >
      <div className={styles.fields}>
        <TextField
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="이메일을 입력해주세요"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value.trim());
            setFailed(false);
          }}
        />
        <TextField
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력해주세요"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFailed(false);
          }}
          error={failed ? '이메일 또는 비밀번호가 올바르지 않습니다' : undefined}
        />
      </div>
    </StepScreen>
  );
}
