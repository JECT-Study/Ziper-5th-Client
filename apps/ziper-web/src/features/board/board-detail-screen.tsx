import { useNavigate } from '@tanstack/react-router';
import { openOriginalUrl, useGetBoardProductsInfinite } from '@ziper/api';
import { errorMessage } from '@ziper/api/http';
import type { GetBoardProductsSort } from '@ziper/api/schemas';
import { useEffect, useRef, useState } from 'react';
import emptyBoard from '../../assets/board/empty-board.png';
import { usePlatform } from '../../bridge/provider';
import {
  BottomNavigation,
  Button,
  ChipFilter,
  HeaderIconButton,
  HeaderSub,
  showToast,
} from '../../components';
import { useTabNavigation } from '../../shared/use-tab-navigation';
import { ProductCard, ProductCardSkeleton } from './product-card';
import { useProductManage } from './use-product-manage';
import * as styles from './board-detail.css';

const SORTS: { value: GetBoardProductsSort; label: string }[] = [
  { value: 'RECENT', label: '최근 등록순' },
  { value: 'OLDEST', label: '오래된 순' },
  { value: 'PRICE_ASC', label: '가격 낮은 순' },
  { value: 'PRICE_DESC', label: '가격 높은 순' },
];

type BoardDetailScreenProps = {
  boardId: number;
  created: boolean;
  onCreatedShown: () => void;
};

export function BoardDetailScreen({ boardId, created, onCreatedShown }: BoardDetailScreenProps) {
  const { platform, status } = usePlatform();
  const selectTab = useTabNavigation();
  const navigate = useNavigate();
  const productManage = useProductManage();
  const [sort, setSort] = useState<GetBoardProductsSort>('RECENT');
  const products = useGetBoardProductsInfinite(
    boardId,
    { sort, size: 20 },
    {
      query: {
        initialPageParam: undefined,
        getNextPageParam: ({ data }) => (data.hasNext ? (data.nextCursor ?? undefined) : undefined),
      },
    },
  );
  const pages = products.data?.pages;
  const page = pages && { ...pages[0].data, items: pages.flatMap(({ data }) => data.items) };

  const announced = useRef(false);
  useEffect(() => {
    if (!created || !page || announced.current) return;
    announced.current = true;
    showToast(`${page.name} 보드를 만들었어요`);
    onCreatedShown();
  }, [created, page, onCreatedShown]);

  const sentinel = useRef<HTMLDivElement>(null);
  const loadMore = useRef(products.fetchNextPage);
  loadMore.current = products.fetchNextPage;
  useEffect(() => {
    const target = sentinel.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore.current();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [products.hasNextPage]);

  const addProduct =
    status === 'initializing'
      ? undefined
      : () =>
          void platform.navigation.push('/register-product').catch(() => {
            showToast('상품 추가 화면을 열지 못했어요.');
          });

  async function goOriginal(cardId: number) {
    try {
      const { data } = await openOriginalUrl(cardId);
      await platform.external.open(data.productUrl);
    } catch (error) {
      showToast(errorMessage(error, '원본 쇼핑몰을 열지 못했어요.'));
    }
  }

  return (
    <main className={styles.page}>
      <HeaderSub
        title={page?.name ?? ''}
        onBack={() => void platform.navigation.back()}
        right={<HeaderIconButton icon="plus-fill" label="상품 추가" onClick={addProduct} />}
      />
      <div className={styles.body}>
        <div className={styles.sorts}>
          {SORTS.map((option) => (
            <ChipFilter
              key={option.value}
              selected={sort === option.value}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </ChipFilter>
          ))}
        </div>

        {products.isPending && (
          <div className={styles.grid} aria-busy>
            {Array.from({ length: 4 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        )}

        {products.isError && !page && (
          <div className={styles.status} role="alert">
            보드를 불러오지 못했어요.
            <Button variant="secondary" size="small" onClick={() => void products.refetch()}>
              다시 시도
            </Button>
          </div>
        )}

        {page && page.items.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyText}>
              <img src={emptyBoard} alt="" width={122} height={111} />
              <div>
                <p className={styles.emptyTitle}>아직 상품이 없어요</p>
                <p className={styles.emptyDescription}>
                  {'상품을 저장하면 이 보드에 담겨요.\n+ 버튼으로 첫 상품을 추가해 보세요.'}
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              leftIcon="plus-small-line"
              className={styles.emptyButton}
              onClick={addProduct}
              disabled={!addProduct}
            >
              상품 추가하기
            </Button>
          </div>
        )}

        {page && page.items.length > 0 && (
          <>
            <div className={styles.grid}>
              {page.items.map((product) => (
                <ProductCard
                  key={product.cardId}
                  product={{ ...product, tags: product.tags.map((tag) => tag.title) }}
                  // Stay in this WebView so Back remounts the board with the edited product.
                  onOpen={() =>
                    void navigate({
                      to: '/products/$cardId',
                      params: { cardId: String(product.cardId) },
                    }).catch(() => showToast('상품 상세를 열지 못했어요.'))
                  }
                  onMore={() => productManage.open(product)}
                  onOpenOriginal={() => void goOriginal(product.cardId)}
                />
              ))}
            </div>
            {products.hasNextPage && <div ref={sentinel} className={styles.sentinel} />}
          </>
        )}
      </div>
      <BottomNavigation active="board" onSelect={selectTab} onAdd={addProduct} />
      {productManage.element}
    </main>
  );
}
