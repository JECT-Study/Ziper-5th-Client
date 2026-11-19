import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Suspense } from 'react';
import { usePlatform } from '../bridge/provider';
import { ProductDetailScreen } from '../features/product-detail/product-detail-screen';
import {
  parseDetailPreview,
  ProductDetailPreview,
} from '../features/product-detail/preview-config';

export const Route = createFileRoute('/products/$cardId')({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: parseDetailPreview(search.preview),
  }),
  head: () => ({
    meta: [{ title: '상품 상세 | Ziper' }],
    links: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap',
      },
    ],
  }),
  component: ProductDetailRoute,
});

function ProductDetailRoute() {
  const { cardId } = Route.useParams();
  const { preview } = Route.useSearch();
  const router = useRouter();
  const { platform, status } = usePlatform();
  const props = {
    cardId,
    onBack:
      status === 'native' || router.history.canGoBack()
        ? () => platform.navigation.back()
        : undefined,
    platformReady: status === 'web' || status === 'native',
    openExternal: (url: string) => platform.external.open(url),
    // Native sheets retain OS dismissal and hardware Back; the browser composes the Figma menu.
    manage:
      status !== 'native'
        ? undefined
        : async (purchased: boolean): Promise<'edit' | 'purchase' | null> => {
            const result = await platform.sheets.actions({
              title: '상품 관리',
              actions: [
                { id: 'edit', label: '상품 수정' },
                ...(purchased ? [] : [{ id: 'purchase', label: '구매 완료' }]),
              ],
            });
            return result.status === 'selected' &&
              (result.actionId === 'edit' || result.actionId === 'purchase')
              ? result.actionId
              : null;
          },
  };
  return ProductDetailPreview && preview ? (
    <Suspense fallback={<p role="status">상품 정보를 불러오는 중이에요.</p>}>
      <ProductDetailPreview key={cardId + preview} {...props} mode={preview} />
    </Suspense>
  ) : (
    <ProductDetailScreen key={cardId} {...props} />
  );
}
