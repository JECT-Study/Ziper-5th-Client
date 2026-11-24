import { useState } from 'react';
import { Icon } from '../../components';
import { cx } from '../../components/cx';
import type { BoardPreviewImage } from './api';
import { fallbackImages } from './fallback-images';
import * as styles from './board.css';

function Tile({ image, large }: { image: BoardPreviewImage | undefined; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = image?.imageUrl && !failed ? image.imageUrl : null;
  const fallback = image?.fallbackIcon ? fallbackImages[image.fallbackIcon] : null;
  return (
    <div className={cx(styles.tile, large && styles.tileLarge, image && styles.tileFilled)}>
      {photo ? (
        <img className={styles.photo} src={photo} alt="" onError={() => setFailed(true)} />
      ) : (
        fallback && <img className={styles.fallback} src={fallback} alt="" />
      )}
    </div>
  );
}

type BoardCardProps = {
  name: string;
  productCount: number;
  previewImages: readonly BoardPreviewImage[];
  onOpen: () => void;
  /** 없으면 ... 버튼을 숨긴다. */
  onMore?: () => void;
  className?: string;
};

export function BoardCard({
  name,
  productCount,
  previewImages,
  onOpen,
  onMore,
  className,
}: BoardCardProps) {
  return (
    <div className={cx(styles.card, className)}>
      <button type="button" className={styles.cardButton} onClick={onOpen} aria-label={name}>
        <div className={styles.collage}>
          <Tile image={previewImages[0]} large />
          <Tile image={previewImages[1]} />
          <Tile image={previewImages[2]} />
        </div>
      </button>
      <div className={styles.info}>
        <div className={styles.nameRow}>
          <p className={styles.name}>{name}</p>
          {onMore && (
            <button
              type="button"
              className={styles.more}
              onClick={onMore}
              aria-label={`${name} 보드 관리`}
            >
              <Icon name="dot3-horizontal-line" />
            </button>
          )}
        </div>
        <p className={styles.count}>{productCount}개</p>
      </div>
    </div>
  );
}

/** 보드 목록을 불러오는 동안 BoardCard 자리에 보여준다. */
export function BoardCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cx(styles.card, className)} aria-hidden>
      <div className={styles.collage}>
        <div className={cx(styles.skeleton, styles.tileLarge)} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
      <div className={styles.info}>
        <div className={cx(styles.skeleton, styles.skeletonName)} />
        <div className={cx(styles.skeleton, styles.skeletonCount)} />
      </div>
    </div>
  );
}
