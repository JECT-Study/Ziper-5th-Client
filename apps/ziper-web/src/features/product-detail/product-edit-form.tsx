import {
  ProductDetailError,
  type FallbackIcon,
  type ProductBoard,
  type ProductDetail,
  type ProductDetailApi,
  type ProductUpdate,
} from '@ziper/api/product-detail';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { Button, ChipFilter, TextField } from '../../components';
import { parseWholeWon } from '../product-save/price';
import * as styles from './product-detail.css';

export function ProductEditForm({
  product,
  api,
  onSaved,
  onCancel,
  onBusyChange,
  onReconcile,
}: {
  product: ProductDetail;
  api: ProductDetailApi;
  onSaved: (product: ProductDetail) => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  onReconcile: () => void;
}) {
  const [title, setTitle] = useState(product.productTitle);
  const [price, setPrice] = useState(product.price?.toString() ?? '');
  const [memo, setMemo] = useState(product.memo);
  const [tags, setTags] = useState(product.tags.join(', '));
  const [boardIds, setBoardIds] = useState(product.boards.map((board) => board.id));
  const [boards, setBoards] = useState<readonly ProductBoard[] | null>(null);
  const [image, setImage] = useState<'keep' | FallbackIcon>('keep');
  const [status, setStatus] = useState<'idle' | 'saving' | 'unknown'>('idle');
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  const busy = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    const request = new AbortController();
    void api
      .listBoards(request.signal)
      .then((value) => {
        if (!request.signal.aborted) {
          setBoards(value);
          setBoardIds((ids) => ids.filter((id) => value.some((board) => board.id === id)));
        }
      })
      .catch(() => {
        if (!request.signal.aborted) setError('보드 목록을 불러오지 못했어요.');
      });
    return () => {
      alive.current = false;
      request.abort();
    };
  }, [api, attempt]);

  const parsedTags = [
    ...new Set(
      tags
        .split(',')
        .map((tag) => tag.trim().replace(/^#+/, '').trim())
        .filter(Boolean),
    ),
  ];
  const amount = parseWholeWon(price);
  const invalidPrice = amount === null || amount > 1_000_000_000;
  const invalidTags = parsedTags.some((tag) => [...tag].length > 6);
  const missingImage =
    image === 'keep' && !product.imageUrl && !product.imageFileId && !product.fallbackIcon;
  const invalidBoards =
    !boards || !boardIds.length || boardIds.some((id) => !boards.some((board) => board.id === id));
  const titleLength = [...title.trim()].length;
  const valid =
    titleLength > 0 &&
    titleLength <= 200 &&
    memo.length <= 100 &&
    !invalidPrice &&
    parsedTags.length > 0 &&
    !invalidTags &&
    !missingImage &&
    !invalidBoards;
  const locked = status !== 'idle';

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || amount === null || busy.current) return;
    busy.current = true;
    setStatus('saving');
    onBusyChange(true);
    setError('');
    const input: ProductUpdate = {
      productTitle: title.trim(),
      shop: product.shop,
      price: amount,
      memo,
      tags: parsedTags,
      boardIds,
      imageUrl: image === 'keep' ? product.imageUrl : null,
      imageFileId: image === 'keep' ? product.imageFileId : null,
      fallbackIcon: image === 'keep' ? product.fallbackIcon : image,
    };
    try {
      const updated = await api.update(product.cardId, input);
      if (alive.current) onSaved(updated);
    } catch (reason) {
      if (!alive.current) return;
      onBusyChange(false);
      if (reason instanceof ProductDetailError) {
        setError(
          reason.code === 'auth-required'
            ? '로그인한 뒤 다시 수정해 주세요.'
            : reason.code === 'not-found' || reason.code === 'forbidden'
              ? '이 상품을 수정할 수 없어요. 상세 화면에서 다시 확인해 주세요.'
              : (reason.detail ?? '수정하지 못했어요. 다시 시도해 주세요.'),
        );
        const retryable = reason.code === 'failed' || reason.code === 'auth-required';
        setStatus(retryable ? 'idle' : 'unknown');
        busy.current = !retryable;
        if (!retryable) onReconcile();
      } else {
        setStatus('unknown');
        onReconcile();
        setError('수정 결과를 확인할 수 없어요. 다시 제출하지 말고 상세 화면에서 확인해 주세요.');
      }
    }
  }
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <fieldset className={styles.fieldset} disabled={locked}>
        <TextField variant="box" label="상품 링크" value={product.productUrl} readOnly />
        <TextField
          variant="box"
          label="상품명"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          helperText={`${titleLength}/200`}
          error={titleLength > 200 && '상품명은 200자까지 저장할 수 있어요. 줄여 주세요.'}
          required
        />
        <TextField
          variant="box"
          label="가격 (원)"
          inputMode="numeric"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          required
          error={
            price.trim() !== '' && invalidPrice && '0원부터 10억원까지의 정수를 입력해 주세요.'
          }
          helperText="0원부터 10억원까지 입력할 수 있어요."
        />
        <TextField
          variant="box"
          label="한 줄 메모"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          maxLength={100}
          showCounter
        />
        <div className={styles.chips} role="group" aria-label="계절 태그">
          {['봄', '여름', '가을', '겨울'].map((season) => (
            <ChipFilter
              key={season}
              className={styles.choice}
              selected={parsedTags.includes(season)}
              onClick={() =>
                setTags(
                  (parsedTags.includes(season)
                    ? parsedTags.filter((tag) => tag !== season)
                    : [...parsedTags, season]
                  ).join(', '),
                )
              }
            >
              {season}
            </ChipFilter>
          ))}
        </div>
        <TextField
          variant="box"
          label="해시태그"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          required
          helperText="해시태그를 1개 이상 입력해 주세요. 여러 개는 쉼표로 구분해요."
          error={invalidTags && '태그 하나는 최대 6자까지 입력할 수 있어요.'}
        />
        <label className={styles.legend}>
          카드 이미지
          <select
            className={styles.select}
            value={image}
            onChange={(event) => setImage(event.target.value as typeof image)}
          >
            <option value="keep">기존 이미지 유지</option>
            <option value="TOP">상의</option>
            <option value="PANTS">바지</option>
            <option value="SKIRT">스커트</option>
            <option value="ACCESSORY">패션잡화</option>
            <option value="BEAUTY">뷰티</option>
          </select>
        </label>
        {missingImage && <p className={styles.error}>카드 이미지 도안을 선택해 주세요.</p>}
      </fieldset>
      <fieldset className={styles.fieldset} disabled={locked}>
        <legend className={styles.legend}>담을 보드 (1개 이상)</legend>
        {boards ? (
          <div className={styles.chips}>
            {boards.map((board) => (
              <ChipFilter
                key={board.id}
                className={styles.choice}
                selected={boardIds.includes(board.id)}
                onClick={() =>
                  setBoardIds((ids) =>
                    ids.includes(board.id)
                      ? ids.filter((id) => id !== board.id)
                      : [...ids, board.id],
                  )
                }
              >
                {board.name}
              </ChipFilter>
            ))}
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setError('');
              retry((n) => n + 1);
            }}
          >
            보드 목록 다시 불러오기
          </Button>
        )}
        {boards && invalidBoards && (
          <p className={styles.error}>현재 보드를 1개 이상 선택해 주세요.</p>
        )}
      </fieldset>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.buttonRow}>
        <Button className={styles.secondary} disabled={status === 'saving'} onClick={onCancel}>
          {status === 'unknown' ? '상세에서 확인' : '취소'}
        </Button>
        <Button
          className={styles.action}
          type="submit"
          disabled={!valid || locked}
          loading={status === 'saving'}
        >
          수정 완료
        </Button>
      </div>
    </form>
  );
}
