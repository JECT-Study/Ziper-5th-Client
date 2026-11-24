import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { usePlatform } from '../bridge/provider';
import { BottomNavigation, Button, HeaderSub } from '../components';
import { requireSignedIn, useLogout } from '../features/auth';
import { useTabNavigation } from '../shared/use-tab-navigation';
import * as styles from '../styles/my.css';

export const Route = createFileRoute('/my')({
  // 로그인 여부는 브라우저에서만 확인할 수 있다.
  ssr: false,
  beforeLoad: requireSignedIn,
  head: () => ({ meta: [{ title: '마이 | Ziper' }] }),
  component: MyPage,
});

// TODO: 마이페이지(JEC-25) 디자인이 나오면 화면을 채운다. 지금은 로그아웃만 둔다.
function MyPage() {
  const navigate = useNavigate();
  const { logout, pending } = useLogout();
  const selectTab = useTabNavigation();
  const { platform, status } = usePlatform();

  async function logoutAndLeave() {
    await logout();
    navigate({ to: '/login', replace: true });
  }

  return (
    <main className={styles.page}>
      <HeaderSub title="마이" />
      <div className={styles.content}>
        <Button variant="secondary" size="small" loading={pending} onClick={logoutAndLeave}>
          로그아웃
        </Button>
      </div>
      <BottomNavigation
        active="my"
        onSelect={selectTab}
        onAdd={
          status === 'initializing'
            ? undefined
            : () => void platform.navigation.push('/register-product').catch(() => {})
        }
      />
    </main>
  );
}
