import { createFileRoute, useLocation, useRouter } from '@tanstack/react-router';
import { Suspense } from 'react';
import { usePlatform } from '../bridge/provider';
import type { ProductSort } from '../features/product-detail/product-sort';
import { purchasesEnabled, productDetailApi } from '../features/product-detail/product-detail-api';
import { ProductDetailScreen } from '../features/product-detail/product-detail-screen';
import {
  parseDetailPreview,
  ProductDetailPreview,
} from '../features/product-detail/preview-config';
import { discardStaleBackLayer } from '../shared/use-back-layer';
import { waitForRouteExit } from '../shared/wait-for-route-exit';

declare module '@tanstack/react-router' {
  interface HistoryState {
    /** Set when opening a product from the purchased list, to return to the same sort. */
    purchasedSource?: { sort?: ProductSort; index: number };
    productAction?: 'edit';
  }
}

export const Route = createFileRoute('/products/$cardId')({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: parseDetailPreview(search.preview),
  }),
  head: () => ({ meta: [{ title: '상품 상세 | Ziper' }] }),
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { cardId } = Route.useParams();
  const { preview } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { platform, status } = usePlatform();
  const { purchasedSource, productAction } = useLocation({
    select: (location) => location.state,
  });
  // The purchased list exists only with the JEC-79 fixture until that API ships.
  const source = purchasesEnabled ? purchasedSource : undefined;

  async function openPurchased(replace: boolean) {
    const { history } = router;
    if (replace && !(await discardStaleBackLayer(history))) {
      throw new Error('Could not leave product confirmation history');
    }
    // Opened from the list: go back to it instead of stacking another list entry.
    if (
      !replace &&
      source &&
      history.location.state.__TSR_index - source.index === 1 &&
      (await waitForRouteExit(history, () => history.back()))
    ) {
      return;
    }
    await navigate({
      to: '/products/purchased',
      search: { sort: source?.sort },
      replace: replace || Boolean(source),
    });
  }

  const props = {
    cardId,
    onBack: async () => {
      if (router.history.canGoBack()) {
        if (!(await waitForRouteExit(router.history, () => router.history.back()))) {
          throw new Error('Could not leave product detail');
        }
      } else if (status === 'native') await platform.navigation.back();
      else if (status === 'web') await navigate({ to: '/boards', replace: true });
    },
    platformReady: status === 'web' || status === 'native',
    openExternal: (url: string) => platform.external.open(url),
  };
  return ProductDetailPreview && preview ? (
    <Suspense fallback={<p role="status">상품 정보를 불러오는 중이에요.</p>}>
      <ProductDetailPreview key={cardId + preview} {...props} mode={preview} />
    </Suspense>
  ) : (
    <ProductDetailScreen
      key={cardId}
      {...props}
      api={productDetailApi}
      onSignIn={() => navigate({ to: '/login', replace: true })}
      initialAction={source ? productAction : undefined}
      onInitialActionHandled={() => {
        const { href, state } = router.history.location;
        router.history.replace(href, { ...state, productAction: undefined });
        router.history.flush();
      }}
      fromPurchasedList={Boolean(source)}
      openPurchased={purchasesEnabled ? openPurchased : undefined}
    />
  );
}
