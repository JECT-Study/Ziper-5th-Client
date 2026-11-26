import { useQueryClient } from '@tanstack/react-query';
import {
  getGetBoardsQueryKey,
  getProductCardDetail,
  useCreateBoard,
  useGetBoards,
  useUpdateProductCard,
  type getBoardsResponse,
} from '@ziper/api';
import { ApiError } from '@ziper/api/http';
import type { ProductCardDetailResponse, UpdateProductCardRequest } from '@ziper/api/schemas';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type SubmitEvent,
} from 'react';
import {
  BottomSheet,
  Button,
  Checkbox,
  ChipFilter,
  Footer,
  Icon,
  TextField,
  Toaster,
  showToast,
} from '../../components';
import {
  BOARD_NAME_MAX,
  INVALID_BOARD_NAME_MESSAGE,
  checkBoardName,
  normalizeBoardName,
} from '../board/board-name';
import * as boardStyles from '../product-save/product-save.css';
import { InlineEntry } from '../product-save/inline-entry';
import {
  codePointLength,
  hasUnsupportedTagCharacters,
  invalidTagCharactersMessage,
  isValidTag,
  normalizeProductMemo,
  normalizeProductTitle,
  normalizeTag,
  parseWholeWon,
  priceRangeMessage,
  productLimits,
  fallbackIcons,
  seasonTags,
  tagInputHint,
  titleLengthMessage,
  type FallbackIcon,
} from '@ziper/api/product-fields';
import { productRejection, readErrorCode, type ProductErrorCode } from './product-errors';
import * as styles from './product-detail.css';

type ProductDetail = ProductCardDetailResponse;
type ProductUpdate = UpdateProductCardRequest;

const iconLabels: Record<FallbackIcon, string> = {
  TOP: '상의',
  PANTS: '바지',
  SKIRT: '스커트',
  ACCESSORY: '패션잡화',
  BEAUTY: '뷰티',
};

function editableFields(product: ProductDetail) {
  return {
    productTitle: product.productTitle,
    shop: product.shop ?? null,
    price: product.price,
    memo: product.memo ?? '',
    tags: product.tags.map(({ title }) => title),
    boardIds: product.boards.map(({ boardId }) => boardId),
    imageUrl: product.imageUrl ?? null,
    imageFileId: product.imageFileId ?? null,
    fallbackIcon: product.fallbackIcon ?? null,
  };
}

type EditableFields = ReturnType<typeof editableFields>;

function snapshot(value: EditableFields | ProductUpdate) {
  const { productTitle, shop, price, memo, tags, boardIds, imageUrl, imageFileId, fallbackIcon } =
    value;
  return JSON.stringify([
    productTitle,
    shop ?? null,
    price,
    memo ?? '',
    [...tags].sort(),
    [...boardIds].sort((a, b) => a - b),
    imageUrl ?? null,
    imageFileId ?? null,
    fallbackIcon ?? null,
  ]);
}

function matchesSnapshot(latest: ProductDetail, expected: EditableFields | ProductUpdate) {
  const fields = editableFields(latest);
  // A mirror worker may attach a file without changing the source image or editable fields.
  // On a manual retry, onChecked rebases "keep image" to the fresh file ID.
  if (
    latest.imageStatus === 'READY' &&
    fields.imageFileId !== null &&
    !expected.imageFileId &&
    expected.imageUrl &&
    fields.imageUrl === expected.imageUrl
  ) {
    fields.imageFileId = null;
  }
  return snapshot(fields) === snapshot(expected);
}

const editErrors: Record<Exclude<ProductErrorCode, 'failed' | 'auth-required'>, string> = {
  forbidden: '이 상품을 수정할 수 없어요. 상세 화면에서 다시 확인해 주세요.',
  'not-found': '이 상품을 수정할 수 없어요. 상세 화면에서 다시 확인해 주세요.',
  'board-not-found': '선택한 보드가 바뀌었어요. 담을 보드를 다시 확인해 주세요.',
  'image-unusable': '기존 이미지를 사용할 수 없어요. 새 도안을 선택해 주세요.',
};

function useInlineEntryTrigger(open: boolean) {
  const trigger = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    const button = trigger.current;
    // An inline input disappears on completion; don't steal focus if it already moved elsewhere.
    if (
      wasOpen.current &&
      !open &&
      button &&
      button.ownerDocument.activeElement === button.ownerDocument.body
    ) {
      button.focus();
    }
    wasOpen.current = open;
  }, [open]);
  return trigger;
}

export type EditRecovery = 'unknown' | 'auth-required' | 'forbidden' | 'not-found';

export function ProductEditForm({
  product,
  onSaved,
  onCancel,
  onBusyChange,
  onReconcile,
  onChecked,
}: {
  product: ProductDetail;
  onSaved: (product: ProductDetail) => void;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  onReconcile: (reason: EditRecovery) => void;
  onChecked: (product: ProductDetail) => void;
}) {
  const formId = useId();
  const [title, setTitle] = useState(product.productTitle);
  const [price, setPrice] = useState(() => String(product.price ?? ''));
  const [editingPrice, setEditingPrice] = useState(false);
  const [memo, setMemo] = useState(product.memo ?? '');
  const [tags, setTags] = useState(() => [
    ...new Set(product.tags.map(({ title }) => normalizeTag(title)).filter(Boolean)),
  ]);
  const [tagOptions, setTagOptions] = useState(() => [...new Set([...seasonTags, ...tags])]);
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const tagTrigger = useInlineEntryTrigger(tagDraft !== null);
  const imageOptions = useRef<HTMLDivElement>(null);
  const [boardIds, setBoardIds] = useState(product.boards.map((board) => board.boardId));
  const [boardName, setBoardName] = useState<string | null>(null);
  const boardTrigger = useInlineEntryTrigger(boardName !== null);
  const [boardError, setBoardError] = useState<
    'duplicate' | 'invalid' | 'forbidden' | 'unknown' | null
  >(null);
  const boardList = useRef<HTMLUListElement>(null);
  const boardActions = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<'keep' | FallbackIcon>('keep');
  const [existingImageRejected, setExistingImageRejected] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'saving' | 'creating-board' | 'unknown' | 'checking' | 'review' | 'auth-required'
  >('idle');
  const unconfirmed = useRef<{ before: ProductDetail; input: ProductUpdate } | null>(null);
  const checkRequest = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      checkRequest.current?.abort();
    };
  }, []);
  const queryClient = useQueryClient();
  const boardsQuery = useGetBoards({ query: { refetchOnMount: 'always' } });
  const updateProductCard = useUpdateProductCard();
  const createBoardMutation = useCreateBoard();
  const boardsLoading = boardsQuery.isFetching && !boardsQuery.isSuccess;
  const boards = boardsQuery.isSuccess ? boardsQuery.data.data.boards : null;
  useEffect(() => {
    // 사라진 보드가 수정을 막지 않도록 뺀다.
    if (boards)
      setBoardIds((ids) => ids.filter((id) => boards.some((board) => board.boardId === id)));
  }, [boards]);
  const retryBoards = () =>
    void queryClient.resetQueries({ queryKey: getGetBoardsQueryKey(), exact: true });
  const boardsFailed = boardsQuery.isError;
  const boardReadError = boardsFailed ? readErrorCode(boardsQuery.error) : undefined;
  const boardsDenied = boardReadError === 'forbidden';
  const requiresLogin = status === 'auth-required' || boardReadError === 'auth-required';
  const creatingBoard = status === 'creating-board';
  const waiting = status === 'saving' || status === 'checking' || creatingBoard;
  const normalizedBoardName = normalizeBoardName(boardName ?? '');
  const nameCheck =
    boardError === 'duplicate' || boardError === 'invalid'
      ? boardError
      : checkBoardName(boardName ?? '', boards?.map(({ name }) => name) ?? []);
  const canCreateBoard = !!boards && nameCheck === 'ok' && boardError !== 'forbidden';
  useEffect(() => {
    if (!requiresLogin) return;
    onReconcile('auth-required');
    showToast('로그인이 만료되어 수정 내용을 저장할 수 없어요.', { toasterId: formId });
  }, [requiresLogin, onReconcile, formId]);
  useEffect(() => {
    // Reloading the choices can push the inline error below the fixed sheet footer.
    if (boardError && !boardsLoading) {
      boardActions.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [boardError, boardsLoading]);

  const newTag = normalizeTag(tagDraft ?? '');
  const canAddTag = tagDraft !== null && isValidTag(tagDraft) && !tags.includes(newTag);
  const amount = parseWholeWon(price.trim().replace(/원$/u, ''));
  const invalidPrice = amount === null;
  const invalidTags = tags.some((tag) => !isValidTag(tag));
  const canKeepImage =
    !existingImageRejected &&
    Boolean(product.imageUrl || product.imageFileId || product.fallbackIcon);
  const missingImage = image === 'keep' && !canKeepImage;
  const invalidBoards =
    !boards ||
    !boardIds.length ||
    boardIds.some((id) => !boards.some((board) => board.boardId === id));
  const normalizedTitle = normalizeProductTitle(title);
  const titleLength = codePointLength(normalizedTitle);
  const normalizedMemo = normalizeProductMemo(memo);
  const memoLength = codePointLength(normalizedMemo);
  const valid =
    titleLength > 0 &&
    titleLength <= productLimits.titleLength &&
    memoLength <= productLimits.memoLength &&
    !invalidPrice &&
    tags.length > 0 &&
    !invalidTags &&
    tagDraft === null &&
    boardName === null &&
    !missingImage &&
    !invalidBoards;
  const locked = (status !== 'idle' && !creatingBoard) || requiresLogin || boardsDenied;
  useEffect(() => {
    if (existingImageRejected) imageOptions.current?.scrollIntoView({ block: 'nearest' });
  }, [existingImageRejected]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || locked || waiting || amount === null || busy.current) return;
    busy.current = true;
    setStatus('saving');
    onBusyChange(true);
    setError('');
    const input: ProductUpdate = {
      productTitle: normalizedTitle,
      shop: product.shop ?? null,
      price: amount,
      memo: normalizedMemo,
      tags,
      boardIds,
      imageUrl: image === 'keep' ? (product.imageUrl ?? null) : null,
      imageFileId: image === 'keep' ? (product.imageFileId ?? null) : null,
      fallbackIcon: image === 'keep' ? (product.fallbackIcon ?? null) : image,
    };
    let rejection: ReturnType<typeof productRejection>;
    try {
      const { data } = await updateProductCard.mutateAsync({ cardId: product.cardId, data: input });
      if (!alive.current) return;
      if (data.cardId === product.cardId) return onSaved(data);
      rejection = null;
    } catch (error) {
      rejection = productRejection(error, { edit: true });
    }
    if (!alive.current) return;
    onBusyChange(false);
    busy.current = false;
    if (!rejection) {
      unconfirmed.current = { before: product, input };
      setStatus('unknown');
      onReconcile('unknown');
      setError('수정 결과를 확인할 수 없어요. 다시 제출하기 전에 현재 상태를 확인해 주세요.');
      return;
    }
    const { code: reason, detail } = rejection;
    setError(
      reason === 'auth-required'
        ? ''
        : reason === 'failed'
          ? (detail ?? '수정하지 못했어요. 다시 시도해 주세요.')
          : editErrors[reason],
    );
    if (reason === 'board-not-found') retryBoards();
    if (reason === 'image-unusable') setExistingImageRejected(true);
    // PATCH distinguishes a missing product from missing board or image references.
    const inaccessible = reason === 'not-found' || reason === 'forbidden';
    setStatus(reason === 'auth-required' ? reason : inaccessible ? 'unknown' : 'idle');
    if (reason === 'not-found') onReconcile(reason);
    // A write permission failure doesn't necessarily prevent a detail read.
    if (reason === 'forbidden') onReconcile('unknown');
  }
  async function checkStatus() {
    const attempt = unconfirmed.current;
    if (!attempt || checkRequest.current) return;
    const controller = new AbortController();
    checkRequest.current = controller;
    setStatus('checking');
    onBusyChange(true);
    setError('');
    try {
      const { data: latest } = await getProductCardDetail(product.cardId, {
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      if (!alive.current) return;
      unconfirmed.current = null;
      if (matchesSnapshot(latest, attempt.input)) {
        onSaved(latest);
        return;
      }
      onChecked(latest);
      if (
        matchesSnapshot(latest, editableFields(attempt.before)) &&
        latest.status === attempt.before.status
      ) {
        setStatus('idle');
        retryBoards();
        setError('조회한 정보에 수정 내용이 아직 없어요. 입력을 확인하고 다시 저장할 수 있어요.');
      } else {
        setStatus('review');
        setError('조회한 정보가 제출한 내용과 달라요. 덮어쓰지 않도록 최신 상세를 확인해 주세요.');
      }
    } catch (error) {
      if (!alive.current) return;
      const code = readErrorCode(error);
      setStatus(code === 'auth-required' ? code : 'unknown');
      if (code === 'not-found' || code === 'forbidden') {
        unconfirmed.current = null;
        onReconcile(code);
      }
      if (code !== 'auth-required') {
        setError(
          code === 'failed' ? '현재 상태를 불러오지 못했어요. 입력은 유지돼요.' : editErrors[code],
        );
      }
    } finally {
      checkRequest.current = null;
      if (alive.current) onBusyChange(false);
    }
  }

  async function createBoard() {
    if (!boardName || !canCreateBoard || busy.current) return;
    busy.current = true;
    onBusyChange(true);
    setStatus('creating-board');
    setBoardError(null);
    try {
      const { data: board } = await createBoardMutation.mutateAsync({
        data: { name: normalizedBoardName },
      });
      if (!alive.current) return;
      queryClient.setQueryData<getBoardsResponse>(
        getGetBoardsQueryKey(),
        (current) =>
          current && {
            ...current,
            data: {
              ...current.data,
              boards: [
                { ...board, previewImages: [] },
                ...current.data.boards.filter((item) => item.boardId !== board.boardId),
              ],
            },
          },
      );
      setBoardIds((current) => [...new Set([...current, board.boardId])]);
      setBoardName(null);
      boardList.current?.scrollTo(0, 0);
    } catch (error) {
      if (!alive.current) return;
      const code = productRejection(error)?.code;
      if (code === 'auth-required') {
        setStatus('auth-required');
        return;
      }
      if (code === 'forbidden' || code === 'failed') {
        setBoardError(code === 'failed' ? 'invalid' : 'forbidden');
        return;
      }
      setBoardError(error instanceof ApiError && error.status === 409 ? 'duplicate' : 'unknown');
      // A concurrent create or a lost reply can leave an existing board. Re-read, never replay POST.
      retryBoards();
    } finally {
      busy.current = false;
      if (alive.current) {
        setStatus((current) => (current === 'creating-board' ? 'idle' : current));
        onBusyChange(false);
      }
    }
  }

  const footer = useRef<HTMLDivElement>(null);
  // A keyboard-activated footer action parks focus on the footer until its result renders.
  function holdKeyboardFocus(event: MouseEvent<HTMLDivElement>) {
    const action = (event.target as Element).closest('button[data-edit-action]');
    if (action && event.detail === 0) footer.current?.focus({ preventScroll: true });
  }

  const retryChoices = status === 'idle' && boardsFailed && !requiresLogin && !boardsDenied;
  const message = requiresLogin
    ? ''
    : boardsDenied
      ? '보드 목록을 볼 수 있는 권한이 없어요. 수정 내용을 저장할 수 없어요.'
      : retryChoices
        ? '보드 목록을 불러오지 못했어요. 입력은 유지돼요.'
        : error;
  useLayoutEffect(() => {
    const anchor = footer.current;
    if (!anchor || waiting || boardsLoading || anchor.ownerDocument.activeElement !== anchor)
      return;
    // Don't land on the draft-discard button when there is no recovery action.
    const target =
      anchor.querySelector<HTMLElement>('button[data-edit-action]:not(:disabled)') ??
      anchor.querySelector<HTMLElement>('[role="alert"]');
    target?.focus();
  }, [waiting, boardsLoading, message]);
  return (
    <BottomSheet
      open
      className={styles.editSheet}
      title="상품 수정"
      fixedTitle
      onClose={onCancel}
      footer={
        <div ref={footer} tabIndex={-1} onClickCapture={holdKeyboardFocus}>
          <Footer layout="stack">
            {message && (
              <div className={styles.error} role="alert" tabIndex={-1}>
                {message}
              </div>
            )}
            {requiresLogin || boardsDenied ? null : (status === 'unknown' ||
                status === 'checking') &&
              unconfirmed.current ? (
              <Button
                data-edit-action
                loading={status === 'checking'}
                onClick={() => void checkStatus()}
              >
                현재 상태 확인
              </Button>
            ) : retryChoices ? (
              <Button data-edit-action onClick={retryBoards}>
                보드 목록 다시 불러오기
              </Button>
            ) : (
              (status === 'idle' || status === 'saving' || creatingBoard) && (
                <Button
                  form={formId}
                  type="submit"
                  data-edit-action
                  onKeyDown={(event) => {
                    // Regaining focus isn't permission to replay a held Enter key.
                    if (event.key === 'Enter' && event.repeat) event.preventDefault();
                  }}
                  disabled={!valid || locked || waiting}
                  loading={status === 'saving'}
                >
                  수정 완료
                </Button>
              )
            )}
            <Button variant="secondary" disabled={waiting} onClick={onCancel}>
              {status === 'review'
                ? '최신 상세 보기'
                : status === 'unknown'
                  ? '상세에서 확인'
                  : '취소'}
            </Button>
          </Footer>
        </div>
      }
    >
      <Toaster id={formId} />
      <form id={formId} className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        <fieldset className={styles.fieldset} disabled={locked}>
          <div className={styles.editFields}>
            <TextField
              variant="box"
              label="상품명"
              readOnly={locked}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onClear={() => setTitle('')}
              error={titleLength > productLimits.titleLength && titleLengthMessage}
              required
            />
            <TextField
              variant="box"
              label="가격"
              readOnly={locked}
              inputMode="numeric"
              value={
                !editingPrice && amount !== null ? `${amount.toLocaleString('ko-KR')}원` : price
              }
              onFocus={() => setEditingPrice(true)}
              onBlur={() => {
                if (amount !== null) setPrice(String(amount));
                setEditingPrice(false);
              }}
              onChange={(event) => setPrice(event.target.value)}
              onClear={() => setPrice('')}
              error={price.trim() !== '' && invalidPrice && priceRangeMessage}
              required
            />
            <div className={styles.fieldGroup} role="group" aria-label="해시태그">
              <span className={styles.legend}>해시태그</span>
              <div className={styles.chips}>
                {tagOptions.map((tag) => (
                  <ChipFilter
                    key={tag}
                    selected={tags.includes(tag)}
                    onClick={() =>
                      setTags((current) =>
                        current.includes(tag)
                          ? current.filter((item) => item !== tag)
                          : [...current, tag],
                      )
                    }
                  >
                    {tag}
                  </ChipFilter>
                ))}
                {tagDraft === null && (
                  <button
                    ref={tagTrigger}
                    type="button"
                    className={styles.addTag}
                    onClick={() => setTagDraft('')}
                  >
                    +직접 추가
                  </button>
                )}
              </div>
              {tagDraft !== null && (
                <InlineEntry
                  label="새 해시태그"
                  value={tagDraft}
                  helperText={tagInputHint}
                  error={
                    hasUnsupportedTagCharacters(tagDraft) ? invalidTagCharactersMessage : undefined
                  }
                  action="태그 추가"
                  disabled={!canAddTag}
                  onChange={setTagDraft}
                  onConfirm={() => {
                    setTagOptions((current) =>
                      current.includes(newTag) ? current : [...current, newTag],
                    );
                    setTags((current) => [...current, newTag]);
                    setTagDraft(null);
                  }}
                  onCancel={() => setTagDraft(null)}
                />
              )}
              {(invalidTags || tags.length === 0) && (
                <p className={styles.caption}>6자 이하의 해시태그를 1개 이상 선택해 주세요.</p>
              )}
            </div>
            <TextField
              variant="box"
              label="한 줄 메모(선택)"
              readOnly={locked}
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              onClear={() => setMemo('')}
              error={
                memoLength > productLimits.memoLength && '한 줄 메모는 100자까지 저장할 수 있어요.'
              }
            />
          </div>
          <section className={styles.fieldGroup} aria-label="보드 선택">
            <span className={styles.legend}>보드 선택</span>
            <div className={boardStyles.boardPanel}>
              {!boardsFailed && !boards && <p role="status">보드 목록을 불러오는 중이에요.</p>}
              {boards && (
                <ul className={boardStyles.boardList} ref={boardList}>
                  {boards.map((board) => (
                    <li key={board.boardId} className={boardStyles.boardRow}>
                      <Checkbox
                        className={boardStyles.boardCheck}
                        checked={boardIds.includes(board.boardId)}
                        onChange={(event) => {
                          const { checked } = event.currentTarget;
                          setBoardIds((ids) =>
                            checked
                              ? [...ids, board.boardId]
                              : ids.filter((id) => id !== board.boardId),
                          );
                          if (
                            checked &&
                            nameCheck === 'duplicate' &&
                            board.name === normalizedBoardName
                          ) {
                            setBoardName(null);
                            setBoardError(null);
                          }
                        }}
                      >
                        {board.name}
                        <span aria-hidden="true" className={boardStyles.boardCount}>
                          {board.productCount}개
                        </span>
                      </Checkbox>
                    </li>
                  ))}
                </ul>
              )}
              {(boards || boardName !== null) && (
                <div className={boardStyles.boardActions} ref={boardActions}>
                  {boardName === null ? (
                    <button
                      type="button"
                      className={boardStyles.addBoard}
                      ref={boardTrigger}
                      onClick={() => setBoardName('')}
                    >
                      <Icon name="plus-small-line" size={16} />새 보드 만들기
                    </button>
                  ) : (
                    <InlineEntry
                      label="새 보드 이름"
                      value={boardName}
                      counter={`${codePointLength(normalizedBoardName)}/${BOARD_NAME_MAX}`}
                      placeholder="보드 이름"
                      action="완료"
                      variant="secondary"
                      loading={creatingBoard}
                      disabled={!canCreateBoard}
                      error={
                        nameCheck === 'duplicate'
                          ? '이미 있는 보드예요. 목록에서 선택해 주세요.'
                          : nameCheck === 'invalid'
                            ? INVALID_BOARD_NAME_MESSAGE
                            : undefined
                      }
                      onChange={(name) => {
                        setBoardName(name);
                        setBoardError(null);
                      }}
                      onConfirm={() => void createBoard()}
                      onCancel={() => {
                        setBoardName(null);
                        setBoardError(null);
                      }}
                    />
                  )}
                  {nameCheck !== 'duplicate' &&
                    (boardError === 'unknown' || boardError === 'forbidden') && (
                      <p className={styles.error} role="alert">
                        {boardError === 'forbidden'
                          ? '새 보드를 만들 수 있는 권한이 없어요.'
                          : '보드 생성 결과를 확인하지 못했어요. 목록을 먼저 확인해 주세요.'}
                      </p>
                    )}
                </div>
              )}
            </div>
            {boards && invalidBoards && (
              <p className={styles.error}>현재 보드를 1개 이상 선택해 주세요.</p>
            )}
          </section>
          {!canKeepImage && (
            <div
              ref={imageOptions}
              className={styles.fieldGroup}
              role="group"
              aria-label="카드 이미지"
            >
              <span className={styles.legend}>카드 이미지 도안을 선택해 주세요.</span>
              <div className={styles.chips}>
                {fallbackIcons.map((icon) => (
                  <ChipFilter
                    key={icon}
                    selected={image === icon}
                    onClick={() => {
                      setImage(icon);
                      if (missingImage && existingImageRejected) setError('');
                    }}
                  >
                    {iconLabels[icon]}
                  </ChipFilter>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      </form>
    </BottomSheet>
  );
}
