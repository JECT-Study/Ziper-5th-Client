import { useNavigate } from '@tanstack/react-router';
import { Button, showToast } from '../../../../components';
import { ApiError, errorMessage } from '../../../../shared/api/http';
import { useSocialSignupMutation } from '../../api/queries';
import { useAgreements } from '../../hooks/useAgreements';
import { SIGNUP_FLOW } from '../../model/guards';
import { clearPendingSignup, loadPendingSignup } from '../../model/pendingSignup';
import { StepScreen } from '../common/StepScreen';
import { Terms } from '../common/Terms';

/**
 * 소셜 로그인으로 처음 온 사람이 보는 약관 동의 화면.
 * 동의해야 회원이 만들어진다. 동의하지 않고 나가면 가입되지 않고, 다음 로그인 때 다시 이 화면으로 온다.
 */
export function SocialTermsPage() {
  const navigate = useNavigate();
  const { agreed, setAgreed, requiredAgreed } = useAgreements();
  const signup = useSocialSignupMutation();
  // 성공한 뒤 화면을 옮기는 동안에도 버튼을 막아 둔다.
  const submitting = signup.isPending || signup.isSuccess;

  function leave() {
    clearPendingSignup();
    navigate({ to: '/login', replace: true });
  }

  function agree() {
    const signupToken = loadPendingSignup();
    if (!signupToken) return leave();
    signup.mutate(
      { signupToken, marketingAgreed: agreed.marketing },
      {
        onSuccess: () => navigate({ to: '/signup/complete', replace: true, state: SIGNUP_FLOW }),
        onError: (error) => {
          // 가입 토큰은 10분 뒤 만료되고 한 번만 쓸 수 있다. 그러면 소셜 로그인부터 다시 한다.
          if (error instanceof ApiError && error.status === 401) {
            showToast('가입 시간이 지났어요. 다시 로그인해주세요');
            return leave();
          }
          showToast(errorMessage(error, '가입하지 못했어요. 다시 시도해주세요'));
        },
      },
    );
  }

  return (
    <StepScreen
      headerTitle="회원 가입"
      onBack={leave}
      title="약관에 동의해주세요"
      description="Ziper 를 시작하려면 아래 약관에 동의가 필요해요"
      actions={
        <Button disabled={!requiredAgreed} loading={submitting} onClick={agree}>
          동의하고 시작하기
        </Button>
      }
    >
      <Terms agreed={agreed} onChange={setAgreed} />
    </StepScreen>
  );
}
