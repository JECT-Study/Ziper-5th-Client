import type { ProductDetail } from '@ziper/api/product-detail';
import { useEffect } from 'react';
import tops from '../../assets/product-detail/tops.png';
import unavailableImage from '../../assets/product-detail/unavailable-image.png';
import pants from '../../assets/product-detail/pants.webp';
import skirt from '../../assets/product-detail/skirt.webp';
import accessory from '../../assets/product-detail/accessory.webp';
import beauty from '../../assets/product-detail/beauty.webp';
import { useProductPhoto } from '../board/use-product-photo';
import * as styles from './product-detail.css';

const artwork = { PANTS: pants, SKIRT: skirt, ACCESSORY: accessory, BEAUTY: beauty };

export function ProductImage({
  product,
  revision,
  onDefaultImage,
}: {
  product: ProductDetail;
  revision: number;
  onDefaultImage?: () => void;
}) {
  const { photo, onPhotoError } = useProductPhoto(product, revision);
  const unavailable = product.linkStatus === 'REMOVED';
  const usingDefault =
    !unavailable &&
    !photo &&
    Boolean(
      product.imageStatus === 'FAILED' ||
      product.imageFileId ||
      product.imageFileUrl ||
      product.imageUrl,
    );
  useEffect(() => {
    if (usingDefault) onDefaultImage?.();
  }, [usingDefault, onDefaultImage]);
  const icon = product.fallbackIcon;
  return (
    <figure className={styles.imageGroup}>
      <div className={unavailable ? `${styles.image} ${styles.unavailable}` : styles.image}>
        {unavailable ? (
          <span className={styles.unavailableLabel}>원본 상품에 접근할 수 없어요</span>
        ) : photo ? (
          <img
            key={photo}
            className={styles.photo}
            src={photo}
            alt={product.productTitle}
            onError={onPhotoError}
          />
        ) : usingDefault ? (
          <img className={styles.topsTemplate} src={unavailableImage} alt="기본 상품 이미지" />
        ) : icon === 'TOP' ? (
          <img className={styles.topsTemplate} src={tops} alt={product.productTitle} />
        ) : icon ? (
          <div className={styles.categoryTemplate}>
            <img
              className={styles.categoryArtwork[icon]}
              src={artwork[icon]}
              alt={product.productTitle}
            />
          </div>
        ) : (
          <span className={styles.caption}>등록된 이미지가 없어요</span>
        )}
      </div>
      {unavailable && <figcaption className={styles.caption}>저장한 정보는 보관돼요.</figcaption>}
    </figure>
  );
}
