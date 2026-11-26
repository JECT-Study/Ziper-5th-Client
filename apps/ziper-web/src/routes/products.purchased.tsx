import { createFileRoute, notFound, useRouter } from '@tanstack/react-router';
import { requireSignedIn } from '../features/auth';
import { purchasesEnabled } from '../features/product-detail/product-detail-api';
import { parseProductSort } from '../features/product-detail/product-sort';
import { PurchasedScreen } from '../features/product-detail/purchased-screen';
import { waitForRouteExit } from '../shared/wait-for-route-exit';

export const Route = createFileRoute('/products/purchased')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({ sort: parseProductSort(search.sort) }),
  beforeLoad: () => {
    if (!purchasesEnabled) throw notFound();
    return requireSignedIn();
  },
  head: () => ({ meta: [{ title: '구매 완료 목록 | Ziper' }] }),
  component: PurchasedRoute,
  errorComponent: () => <PurchasedRoute entryError />,
});

function PurchasedRoute({ entryError = false }: { entryError?: boolean }) {
  const router = useRouter();
  const navigate = Route.useNavigate();
  const { sort = 'RECENT' } = Route.useSearch();
  return (
    <PurchasedScreen
      sort={sort}
      onSortChange={(next) => void navigate({ search: { sort: next }, replace: true })}
      entryError={entryError}
      onRetryEntry={() => void router.invalidate()}
      openProduct={(product, productAction) =>
        navigate({
          to: '/products/$cardId',
          params: { cardId: product.cardId },
          search: { preview: undefined },
          state: {
            purchasedSource: { sort, index: router.history.location.state.__TSR_index },
            productAction,
          },
        })
      }
      goBack={async () => {
        const { history } = router;
        if (!history.canGoBack()) await navigate({ to: '/boards', replace: true });
        else if (!(await waitForRouteExit(history, () => history.back()))) {
          throw new Error('Could not leave purchased list');
        }
      }}
      signIn={() => navigate({ to: '/login', replace: true })}
    />
  );
}
