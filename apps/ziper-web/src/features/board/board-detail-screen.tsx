import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { errorMessage } from '../../shared/api/http';
import { useTabNavigation } from '../../shared/use-tab-navigation';
import { openOriginal, type BoardSort } from './api';
import { ProductCard, ProductCardSkeleton } from './product-card';
import { useBoardProductsQuery } from './queries';
import * as styles from './board-detail.css';

const SORTS: { value: BoardSort; label: string }[] = [
  { value: 'RECENT', label: '최근 등록순' },
  { value: 'OLDEST', label: '오래된 순' },
  { value: 'PRICE_ASC', label: '가격 낮은 순' },
  { value: 'PRICE_DESC', label: '가격 높은 순' },
];

type BoardDetailScreenProps = {
  boardId: number;
  /** 방금 만든 보드. "만들었어요" 토스트를 띄운다. */
  created: boolean;
  onCreatedShown: () => void;
};

export function BoardDetailScreen({ boardId, created, onCreatedShown }: BoardDetailScreenProps) {
  const { platform, status } = usePlatform();
  const selectTab = useTabNavigation();
  const navigate = useNavigate();
  const [sort, setSort] = useState<BoardSort>('RECENT');
  // 정렬마다 캐시가 따로라, 한 번 본 정렬로 돌아가면 바로 보이고 뒤에서 새로 받는다.
  const products = useBoardProductsQuery(boardId, sort);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = products;
  // 받은 쪽들을 하나로 합친다. 보드 이름 등은 첫 쪽 것을 쓴다.
  const page = useMemo(() => {
    const pages = products.data?.pages;
    if (!pages?.length) return null;
    return { ...pages[0], items: pages.flatMap((p) => p.items) };
  }, [products.data]);

  // 방금 만든 보드면 이름을 알게 된 뒤 한 번만 알린다.
  const announced = useRef(false);
  useEffect(() => {
    if (!created || !page || announced.current) return;
    announced.current = true;
    showToast(`${page.name} 보드를 만들었어요`);
    onCreatedShown();
  }, [created, page, onCreatedShown]);

  // 목록 끝이 보이면 다음 쪽을 불러온다. 받는 중에는 또 부르지 않는다.
  const sentinel = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(() => {});
  loadMoreRef.current = () => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  };
  useEffect(() => {
    const target = sentinel.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage]);

  const addProduct =
    status === 'initializing'
      ? undefined
      : () =>
          void platform.navigation.push('/register-product').catch(() => {
            showToast('상품 추가 화면을 열지 못했어요.');
          });

  async function goOriginal(cardId: number) {
    try {
      await platform.external.open(await openOriginal(cardId));
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
                      search: { preview: undefined },
                    }).catch(() => showToast('상품 상세를 열지 못했어요.'))
                  }
                  // TODO: 상품 관리 시트(구매 완료·상품 수정·삭제)와 연결한다.
                  onMore={() => {}}
                  onOpenOriginal={() => void goOriginal(product.cardId)}
                />
              ))}
            </div>
            {hasNextPage && <div ref={sentinel} className={styles.sentinel} />}
          </>
        )}
      </div>
      <BottomNavigation active="board" onSelect={selectTab} onAdd={addProduct} />
    </main>
  );
}
