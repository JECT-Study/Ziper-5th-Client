import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useLoginWithEmail } from '@ziper/api';
import { ApiError, errorMessage, startSession } from '@ziper/api/http';
import { useState } from 'react';
import { Button, TextField, showToast } from '../../../../components';
import { emailLoginSchema } from '../../model/rules';
import { StepScreen } from '../common/StepScreen';
import { fields } from '../common/StepScreen.css';

const FAILURE_MESSAGE = {
  wrong: '비밀번호가 올바르지 않아요.',
  locked: '비밀번호 최대 입력 횟수를 초과했습니다.\n30분 후 다시 시도해 주세요.',
};

/** 이메일 로그인(RQ-AUTH-16). */
export function EmailLoginPage() {
  const navigate = useNavigate();
  const login = useLoginWithEmail({
    mutation: { onSuccess: ({ data }) => startSession(data.accessToken) },
  });
  // locked: 여러 번 틀려 잠김(백엔드가 429 로 알린다)
  const [failure, setFailure] = useState<'wrong' | 'locked' | null>(null);
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onMount: emailLoginSchema, onChange: emailLoginSchema },
    listeners: { onChange: () => setFailure(null) },
    onSubmit: async ({ value }) => {
      try {
        await login.mutateAsync({ data: value });
        showToast('로그인 성공');
        navigate({ to: '/', replace: true });
      } catch (error) {
        // 백엔드는 없는 이메일·틀린 비밀번호·소셜 전용 계정을 모두 같은 401 로 준다(계정 유무를 숨기려고).
        if (error instanceof ApiError && error.status === 401) setFailure('wrong');
        else if (error instanceof ApiError && error.status === 429) setFailure('locked');
        else showToast(errorMessage(error, '로그인하지 못했어요. 다시 시도해주세요'));
      }
    },
  });

  return (
    <StepScreen
      onBack={() => navigate({ to: '/login' })}
      title="로그인"
      description="가입한 이메일과 비밀번호를 입력해 주세요."
      actions={
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              disabled={!canSubmit || failure === 'locked'}
              loading={login.isPending || login.isSuccess}
              onClick={() => void form.handleSubmit()}
            >
              로그인
            </Button>
          )}
        </form.Subscribe>
      }
    >
      <div className={fields}>
        <form.Field name="email">
          {(field) => (
            <TextField
              label="이메일"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="이메일을 입력해주세요"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value.trim())}
              autoFocus
            />
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <TextField
              label="비밀번호"
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호를 입력해주세요"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onClear={() => field.handleChange('')}
              error={failure ? FAILURE_MESSAGE[failure] : undefined}
            />
          )}
        </form.Field>
      </div>
    </StepScreen>
  );
}
