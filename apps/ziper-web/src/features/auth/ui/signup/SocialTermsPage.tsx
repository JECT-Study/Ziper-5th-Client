import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useSignupWithOAuth } from '@ziper/api';
import { ApiError, errorMessage, startSession } from '@ziper/api/http';
import * as v from 'valibot';
import { Button, showToast } from '../../../../components';
import { SIGNUP_FLOW } from '../../model/guards';
import { clearPendingSignup, loadPendingSignup } from '../../model/pendingSignup';
import { agreementsSchema } from '../../model/rules';
import { noAgreements } from '../../model/terms';
import { StepScreen } from '../common/StepScreen';
import { Terms } from '../common/Terms';

const termsSchema = v.object({ agreements: agreementsSchema });

/**
 * 소셜 로그인으로 처음 온 사람이 보는 약관 동의 화면.
 * 동의해야 회원이 만들어진다. 동의하지 않고 나가면 가입되지 않고, 다음 로그인 때 다시 이 화면으로 온다.
 */
export function SocialTermsPage() {
  const navigate = useNavigate();
  const signup = useSignupWithOAuth({
    mutation: {
      onSuccess: ({ data }) => {
        startSession(data.accessToken ?? null);
        clearPendingSignup();
      },
    },
  });

  const form = useForm({
    defaultValues: { agreements: noAgreements },
    validators: { onMount: termsSchema, onChange: termsSchema },
    onSubmit: ({ value }) => agree(value.agreements.marketing),
  });

  function leave() {
    clearPendingSignup();
    navigate({ to: '/login', replace: true });
  }

  async function agree(marketing: boolean) {
    const signupToken = loadPendingSignup();
    if (!signupToken) return leave();
    try {
      await signup.mutateAsync({
        data: {
          signupToken,
          agreements: { termsOfService: true, privacyPolicy: true, marketing },
        },
      });
      navigate({ to: '/signup/complete', replace: true, state: SIGNUP_FLOW });
    } catch (error) {
      // 가입 토큰은 10분 뒤 만료되고 한 번만 쓸 수 있다. 그러면 소셜 로그인부터 다시 한다.
      if (error instanceof ApiError && error.status === 401) {
        showToast('가입 시간이 지났어요. 다시 로그인해주세요');
        return leave();
      }
      showToast(errorMessage(error, '가입하지 못했어요. 다시 시도해주세요'));
    }
  }

  return (
    <StepScreen
      headerTitle="회원 가입"
      onBack={leave}
      title="약관에 동의해주세요"
      description="Ziper 를 시작하려면 아래 약관에 동의가 필요해요"
      actions={
        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button
              disabled={!canSubmit}
              loading={signup.isPending || signup.isSuccess}
              onClick={() => void form.handleSubmit()}
            >
              동의하고 시작하기
            </Button>
          )}
        </form.Subscribe>
      }
    >
      <form.Field name="agreements">
        {(field) => <Terms agreed={field.state.value} onChange={field.handleChange} />}
      </form.Field>
    </StepScreen>
  );
}
