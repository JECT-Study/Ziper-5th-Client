import { useLayoutEffect, useState, type MouseEventHandler, type Ref } from 'react';
import {
  ProductDetailError,
  type PurchasedProduct,
  type ProductPurchases,
} from '@ziper/api/product-detail';
import { Button } from '../../components';
import { ProductCard, ProductCardSkeleton } from '../board/product-card';
import type { ProductSort } from './product-sort';
import { ProductSortChips } from './product-sort-chips';
import { useProductPages } from './use-product-pages';
import { useProductPageFocus } from './use-product-page-focus';
import * as boardStyles from '../board/board-detail.css';

type AccessError = 'auth-required' | 'forbidden';

type Props = {
  api: ProductPurchases;
  missingCards?: ReadonlySet<string>;
  onOpen?: (product: PurchasedProduct) => void;
  onOpenOriginal: (product: PurchasedProduct) => void;
  onAccessDenied?: (code: AccessError, moveFocus: boolean) => void;
};

export function PurchasedProducts({
  sort,
  onSortChange,
  visitRevision = 0,
  ...props
}: Props & {
  sort?: ProductSort;
  onSortChange?: (sort: ProductSort) => void;
  visitRevision?: number;
}) {
  const [previewSort, setPreviewSort] = useState<ProductSort>('RECENT');
  const selected = sort ?? previewSort;
  return (
    <>
      <ProductSortChips sort={selected} onChange={onSortChange ?? setPreviewSort} />
      <PurchasedGrid
        key={selected}
        sort={selected}
        revision={
          (props.missingCards?.size ?? 0) +
          (selected === 'RECENT' || selected === 'OLDEST' ? visitRevision : 0)
        }
        {...props}
      />
    </>
  );
}

function PurchasedGrid({
  api,
  missingCards,
  sort,
  onOpen,
  onOpenOriginal,
  onAccessDenied,
  revision,
}: Props & { sort: ProductSort; revision: number }) {
  const { page, status, error, retry, canLoadMore, loadMore, refreshing, rejectedCursor } =
    useProductPages((signal, cursor) => api.list(sort, signal, cursor), revision);
  const waiting = status === 'loading';
  const code = error instanceof ProductDetailError ? error.code : undefined;
  const accessError = code === 'auth-required' || code === 'forbidden' ? code : null;
  const items = accessError
    ? undefined
    : page?.items.filter((product) => !missingCards?.has(product.cardId));
  const { grid, pager, empty, pageAction } = useProductPageFocus(status, items?.length ?? 0);
  useLayoutEffect(() => {
    if (!accessError) return;
    // Hand off focus before the route replaces the list with its access notice.
    const anchor = pager.current;
    onAccessDenied?.(accessError, Boolean(anchor && anchor === anchor.ownerDocument.activeElement));
  }, [accessError, onAccessDenied, pager]);
  return (
    <>
      {waiting && !page && (
        <div
          className={boardStyles.grid}
          role="status"
          aria-label="구매 완료 목록을 불러오는 중이에요"
          aria-busy
        >
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </div>
      )}
      {items &&
        (items.length > 0 ? (
          <div className={boardStyles.grid} ref={grid}>
            {items.map((product) => (
              <ProductCard
                key={product.cardId}
                product={product}
                purchased
                onOpen={onOpen ? () => onOpen(product) : undefined}
                onOpenOriginal={() => onOpenOriginal(product)}
              />
            ))}
          </div>
        ) : (
          !refreshing && (
            <p className={boardStyles.status} role="status" ref={empty} tabIndex={-1}>
              구매 완료한 상품이 없어요.
            </p>
          )
        ))}
      <div ref={pager} tabIndex={-1}>
        {accessError === 'auth-required' ? null : accessError ? (
          <PurchasedListError forbidden />
        ) : status === 'error' ? (
          <PurchasedListError
            nextPage={Boolean(page && !refreshing && !rejectedCursor)}
            retry={(event) => pageAction(event, retry, refreshing || rejectedCursor)}
          />
        ) : canLoadMore ? (
          <div className={boardStyles.status}>
            <Button
              variant="secondary"
              size="small"
              onClick={(event) => pageAction(event, loadMore)}
            >
              더 불러오기
            </Button>
          </div>
        ) : waiting && page ? (
          <p className={boardStyles.status} role="status">
            {refreshing ? '구매 완료 목록을 갱신하는 중이에요.' : '다음 상품을 불러오는 중이에요.'}
          </p>
        ) : null}
      </div>
    </>
  );
}

export function PurchasedListError({
  forbidden,
  ref,
  nextPage,
  retry,
}: {
  forbidden?: boolean;
  ref?: Ref<HTMLDivElement>;
  nextPage?: boolean;
  retry?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <div ref={ref} className={boardStyles.status} role="alert" tabIndex={ref ? -1 : undefined}>
      {forbidden
        ? '구매 완료 목록을 볼 수 있는 권한이 없어요.'
        : nextPage
          ? '다음 상품을 불러오지 못했어요.'
          : '구매 완료 목록을 불러오지 못했어요.'}
      {retry && (
        <Button variant="secondary" size="small" onClick={retry}>
          {nextPage ? '다음 상품 다시 불러오기' : '목록 다시 불러오기'}
        </Button>
      )}
    </div>
  );
}
