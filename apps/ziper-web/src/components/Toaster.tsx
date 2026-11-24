import { Toaster as SonnerToaster, toast } from 'sonner';
import { Toast } from './Toast';
import * as styles from './Toast.css';

const DURATION_MS = 2500;
const OFFSET = { bottom: 'calc(env(safe-area-inset-bottom) + 94px)', left: 16, right: 16 };

/** 화면 아래에서 올라오는 토스트를 띄운다. 쌓기·애니메이션·사라지기는 Sonner 가 맡고, 모양은 Toast 를 쓴다. */
export function showToast(message: string) {
  toast.custom(
    () => (
      <div className={styles.slot}>
        <Toast>{message}</Toast>
      </div>
    ),
    { duration: DURATION_MS },
  );
}

/** 앱 루트에 한 번만 둔다. */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      // Figma: 하단 탭(69px) 위로 25px 띄운다. 하단 탭이 없는 화면에서는 아래 버튼 위에 걸친다.
      offset={OFFSET}
      mobileOffset={OFFSET}
      visibleToasts={1}
      // 600px 보다 넓은 화면에서는 Sonner 가 토스트 칸을 내용 크기로 줄여 왼쪽에 붙인다. 칸을 꽉 채워 가운데에 둔다.
      toastOptions={{ className: styles.item }}
    />
  );
}
