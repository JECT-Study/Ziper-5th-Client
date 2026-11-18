import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { BridgeError } from '@ziper/bridge/contract';
import { usePlatform } from '../bridge/provider';
import { useIncomingShare } from '../features/product-save/incoming-share';
import { ProductSaveScreen, ScreenShell } from '../features/product-save/product-save-screen';

const Preview = import.meta.env.DEV ? lazy(() => import('../features/product-save/preview')) : null;

export const Route = createFileRoute('/share-product')({
  validateSearch: (search: Record<string, unknown>) => ({
    preview:
      import.meta.env.DEV &&
      typeof search.preview === 'string' &&
      /^(auto|manual|unsupported|offline|auth|duplicate|failed|unknown)$/.test(search.preview)
        ? search.preview
        : undefined,
  }),
  component: ShareProductRoute,
});

function ShareProductRoute() {
  const { preview } = Route.useSearch();
  return Preview && preview ? (
    <Suspense fallback={null}>
      <Preview key={preview} mode={preview} />
    </Suspense>
  ) : (
    <Incoming />
  );
}

function Incoming() {
  const { platform, status } = usePlatform();
  const share = useIncomingShare({ keepFirst: true });
  const navigate = useNavigate();

  async function close() {
    if (status !== 'native') {
      await navigate({ to: '/' });
      return;
    }
    if (share) {
      try {
        await platform.incomingShare.dismiss(share.id);
      } catch (error) {
        // If the screen is already gone the native Back handler owns the same dismissal.
        if (error instanceof BridgeError && error.code === 'PERMISSION_DENIED') return;
        throw error;
      }
    }
    await platform.navigation.back();
  }

  if (share) return <ProductSaveScreen key={share.id} url={share.url} onClose={close} />;
  const loading = status === 'initializing' || (status === 'native' && share === undefined);
  return (
    <ScreenShell onClose={close}>
      <p role="status">
        {loading ? '공유 링크를 확인하는 중이에요.' : '공유로 받은 상품 링크가 없어요.'}
      </p>
    </ScreenShell>
  );
}
