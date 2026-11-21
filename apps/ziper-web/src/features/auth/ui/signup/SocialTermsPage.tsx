import { useNavigate } from '@tanstack/react-router';
import { Button } from '../../../../components';
import { useAgreements } from '../../hooks/useAgreements';
import { useLogout } from '../../hooks/useLogout';
import { SIGNUP_FLOW } from '../../model/guards';
import { StepScreen } from '../common/StepScreen';
import { Terms } from '../common/Terms';

/**
 * 소셜 로그인으로 처음 가입한 사람이 보는 약관 동의 화면.
 * 백엔드는 소셜 로그인 때 이미 가입을 끝내므로, 동의를 받고 가입 완료 화면으로 넘긴다.
 */
export function SocialTermsPage() {
  const navigate = useNavigate();
  const { agreed, setAgreed, requiredAgreed } = useAgreements();
  const { logout, pending: leaving } = useLogout();

  // 동의하지 않고 나가면 로그인 상태로 남지 않게 로그아웃한다.
  async function leave() {
    await logout();
    navigate({ to: '/login', replace: true });
  }

  function agree() {
    // TODO(백엔드): 소셜 가입자의 약관 동의 저장 API 가 생기면 agreed 를 보낸다.
    navigate({ to: '/signup/complete', replace: true, state: SIGNUP_FLOW });
  }

  return (
    <StepScreen
      headerTitle="회원 가입"
      onBack={leave}
      title="약관에 동의해주세요"
      description="Ziper 를 시작하려면 아래 약관에 동의가 필요해요"
      actions={
        <Button disabled={!requiredAgreed || leaving} onClick={agree}>
          동의하고 시작하기
        </Button>
      }
    >
      <Terms agreed={agreed} onChange={setAgreed} />
    </StepScreen>
  );
}
