import { Toaster as SonnerToaster, toast } from 'sonner';
import { Toast } from './Toast';
import * as styles from './Toast.css';

const DURATION_MS = 2500;

/** 화면 위에서 내려오는 토스트를 띄운다. 쌓기·애니메이션·사라지기는 Sonner 가 맡고, 모양은 Toast 를 쓴다. */
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
      position="top-center"
      offset={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
      visibleToasts={1}
      // 600px 보다 넓은 화면에서는 Sonner 가 토스트 칸을 내용 크기로 줄여 왼쪽에 붙인다. 칸을 꽉 채워 가운데에 둔다.
      toastOptions={{ className: styles.item }}
    />
  );
}
