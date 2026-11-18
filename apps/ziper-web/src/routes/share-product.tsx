import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Suspense } from 'react';
import { BridgeError } from '@ziper/bridge/contract';
import { usePlatform } from '../bridge/provider';
import { useIncomingShare } from '../features/product-save/incoming-share';
import { ProductSavePreview, parsePreviewMode } from '../features/product-save/preview-config';
import { ProductSaveScreen, ScreenShell } from '../features/product-save/product-save-screen';

export const Route = createFileRoute('/share-product')({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: parsePreviewMode(search.preview),
  }),
  component: ShareProductRoute,
});

function ShareProductRoute() {
  const { preview } = Route.useSearch();
  const navigate = Route.useNavigate();
  return ProductSavePreview && preview ? (
    <Suspense fallback={null}>
      <ProductSavePreview key={preview} mode={preview} onClose={() => navigate({ to: '/' })} />
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
