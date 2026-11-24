import { useLocation, useNavigate } from '@tanstack/react-router';
import type { BottomTab } from '../components';

// 아직 화면이 없는 탭(보드·재발견)은 빠져 있다. 화면이 생기면 주소를 더한다.
const TAB_PATHS: Partial<Record<BottomTab, string>> = { home: '/', my: '/my' };

/**
 * 하단 탭을 누르면 그 탭 화면으로 바꾼다. 보드 상세처럼 탭 아래 화면에서는 같은 탭을 눌러도 그 탭의 첫 화면으로 간다.
 *
 * 탭은 앱 네이티브 이동(platform.navigation)을 쓰지 않는다. 네이티브는 화면을 스택에 바꿔 끼우면서
 * 슬라이드로 넘어가서, 탭처럼 화면만 바뀌지 않는다. 지금 WebView 안에서 주소만 바꾸고(replace),
 * history 를 쌓지 않으니 뒤로 가기도 탭 사이를 거슬러 가지 않는다.
 */
export function useTabNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (tab: BottomTab) => {
    const path = TAB_PATHS[tab];
    if (!path || path === pathname) return;
    void navigate({ to: path, replace: true });
  };
}
