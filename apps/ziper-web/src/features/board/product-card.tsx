import { Icon } from '../../components';
import { cx } from '../../components/cx';
import type { FallbackIcon } from '@ziper/api/product-fields';
import type { ProductLinkStatusResponseStatus } from '@ziper/api/schemas';
import { fallbackImages } from './fallback-images';
import { useProductPhoto } from './use-product-photo';
import * as styles from './board-detail.css';

const won = new Intl.NumberFormat('ko-KR');

type ProductCardProps = {
  product: {
    productTitle: string;
    price: number | null;
    tags: readonly string[];
    shop?: string | null;
    imageUrl?: string | null;
    imageFileUrl?: string | null;
    fallbackIcon?: FallbackIcon | null;
    linkStatus?: ProductLinkStatusResponseStatus;
  };
  onOpen?: () => void;
  onMore?: () => void;
  onOpenOriginal?: () => void;
  purchased?: boolean;
};

/** 보드 상세의 상품 카드 (Figma "ZIPER / Product card") */
export function ProductCard({
  product,
  onOpen,
  onMore,
  onOpenOriginal,
  purchased,
}: ProductCardProps) {
  const { photo, onPhotoError } = useProductPhoto(product);
  const fallback = product.fallbackIcon ? fallbackImages[product.fallbackIcon] : null;
  const soldOut = product.linkStatus === 'SOLD_OUT';
  const openOriginal = product.linkStatus === 'REMOVED' ? undefined : onOpenOriginal;

  return (
    <article className={styles.card}>
      <div className={styles.imageSection}>
        <div className={styles.imageArea}>
          <button type="button" className={styles.imageButton} onClick={onOpen} disabled={!onOpen}>
            {photo ? (
              <img
                key={photo}
                className={styles.photo}
                src={photo}
                alt={product.productTitle}
                onError={onPhotoError}
              />
            ) : fallback ? (
              <img className={styles.fallback} src={fallback} alt={product.productTitle} />
            ) : (
              <span className={styles.noImage}>{product.productTitle}</span>
            )}
          </button>
          {onMore && (
            <button
              type="button"
              className={styles.more}
              onClick={onMore}
              aria-label={`${product.productTitle} 상품 관리`}
            >
              <Icon name="dot3-horizontal-line" />
            </button>
          )}
        </div>
        <button
          type="button"
          className={styles.originalLink}
          onClick={openOriginal}
          disabled={!openOriginal}
        >
          {openOriginal ? '원본 쇼핑몰로 이동' : '원본 상품 접근불가'}
          {openOriginal && <Icon name="arrow-up-right-fill" size={12} />}
        </button>
      </div>
      <button type="button" className={styles.info} onClick={onOpen} disabled={!onOpen}>
        {product.shop && <span className={styles.shop}>{product.shop}</span>}
        <span className={styles.title}>{product.productTitle}</span>
        <span className={styles.price}>
          {product.price === null ? '가격 정보 없음' : won.format(product.price) + '원'}
        </span>
      </button>
      {(product.tags.length > 0 || purchased || soldOut) && (
        <ul className={styles.tags} aria-label="상품 태그 및 상태">
          {product.tags.map((tag) => (
            <li key={tag} className={styles.tag}>
              {tag}
            </li>
          ))}
          {purchased && <li className={styles.purchasedTag}>구매 완료</li>}
          {soldOut && <li className={styles.tag}>품절</li>}
        </ul>
      )}
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className={styles.card} aria-hidden>
      <div className={cx(styles.skeleton, styles.skeletonImage)} />
      <div className={cx(styles.skeleton, styles.skeletonLine, styles.skeletonShort)} />
      <div className={cx(styles.skeleton, styles.skeletonLine)} />
      <div className={cx(styles.skeleton, styles.skeletonLine, styles.skeletonMedium)} />
    </div>
  );
}
