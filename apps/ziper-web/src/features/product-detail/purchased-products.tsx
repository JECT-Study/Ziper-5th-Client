import { useLayoutEffect, useRef, useState, type MouseEventHandler, type Ref } from 'react';
import {
  ProductDetailError,
  type PurchasedProduct,
  type ProductPurchases,
} from '@ziper/api/product-detail';
import { Button, showToast } from '../../components';
import { useBackLayer } from '../../shared/use-back-layer';
import { ProductCard, ProductCardSkeleton } from '../board/product-card';
import type { ProductSort } from './product-sort';
import { ProductSortChips } from './product-sort-chips';
import { useProductPages } from './use-product-pages';
import { useProductPageFocus } from './use-product-page-focus';
import * as boardStyles from '../board/board-detail.css';
import { ProductManageSheet } from './product-manage-sheet';

type AccessError = 'auth-required' | 'forbidden';

type Props = {
  api: ProductPurchases;
  missingCards?: ReadonlySet<string>;
  onOpen?: (product: PurchasedProduct) => void;
  onEdit?: (product: PurchasedProduct) => Promise<unknown>;
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
  onEdit,
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
  const [managedId, setManagedId] = useState<string | null>(null);
  const managed =
    !accessError && managedId !== null
      ? items?.find((item) => item.cardId === managedId)
      : undefined;
  if (managedId !== null && !managed) setManagedId(null);
  const menuOpen = Boolean(managed);
  const selecting = useRef(false);
  const close = () => {
    if (!selecting.current) setManagedId(null);
  };
  const discard = useBackLayer(menuOpen, close);

  async function edit() {
    if (!menuOpen || !onEdit || !managed || selecting.current) return;
    selecting.current = true;
    try {
      if (!(await discard())) throw new Error('Could not close product menu');
      await onEdit(managed);
    } catch {
      showToast('상품 수정 화면을 열지 못했어요. 다시 시도해 주세요.');
    } finally {
      selecting.current = false;
      setManagedId(null);
    }
  }

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
                onMore={onEdit ? () => setManagedId(product.cardId) : undefined}
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
        {accessError ? (
          <PurchasedListError code={accessError} />
        ) : status === 'error' ? (
          <PurchasedListError
            stage={rejectedCursor ? 'restart' : refreshing ? 'refresh' : page ? 'next' : 'initial'}
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
      <ProductManageSheet
        open={menuOpen}
        canPurchase={false}
        onSelect={() => void edit()}
        onClose={close}
      />
    </>
  );
}

const purchaseReadErrors = {
  initial: '구매 완료 목록을 불러오지 못했어요.',
  next: '다음 상품을 불러오지 못했어요.',
  refresh: '구매 완료 목록을 갱신하지 못했어요.',
  restart: '다음 상품을 이어서 불러올 수 없어요. 목록을 다시 불러와 주세요.',
};

export function PurchasedListError({
  code,
  ref,
  stage = 'initial',
  onSignIn,
  retry,
}: {
  code?: AccessError;
  ref?: Ref<HTMLDivElement>;
  stage?: keyof typeof purchaseReadErrors;
  onSignIn?: () => void;
  retry?: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <div ref={ref} className={boardStyles.status} role="alert" tabIndex={ref ? -1 : undefined}>
      {code === 'forbidden'
        ? '구매 완료 목록을 볼 수 있는 권한이 없어요.'
        : code === 'auth-required'
          ? '로그인한 뒤 구매 완료 목록을 확인해 주세요.'
          : purchaseReadErrors[stage]}
      {onSignIn && (
        <Button variant="secondary" size="small" onClick={onSignIn}>
          로그인 화면으로 이동
        </Button>
      )}
      {retry && (
        <Button variant="secondary" size="small" onClick={retry}>
          {stage === 'next' ? '다음 상품 다시 불러오기' : '목록 다시 불러오기'}
        </Button>
      )}
    </div>
  );
}
