import type {
  CardImage,
  ProductLookup,
  ProductSaveApi,
  ProductSaveResult,
} from '@ziper/api/product-save';
import { unknownOutcome } from '@ziper/api/outcome';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import accessory from '../../assets/product-save/accessory.png';
import beauty from '../../assets/product-save/beauty.png';
import pants from '../../assets/product-save/pants.png';
import skirt from '../../assets/product-save/skirt.png';
import tops from '../../assets/product-save/tops.png';
import {
  Button,
  Checkbox,
  ChipFilter,
  Icon,
  SegmentedControl,
  TextField,
  Toast,
} from '../../components';
import {
  codePointLength,
  normalizeTag,
  parseWholeWon,
  priceRangeMessage,
  productLimits,
  seasonTags,
  titleLengthMessage,
  type FallbackIcon,
} from '@ziper/api/product-fields';
import { useLoad } from '../../shared/use-load';
import { InlineEntry } from './inline-entry';
import { useLinkedImage } from './use-linked-image';
import * as styles from './product-save.css';

const initialTags: readonly string[] = seasonTags;
const templates: readonly { id: FallbackIcon; label: string; src: string }[] = [
  { id: 'TOP', label: '상의', src: tops },
  { id: 'PANTS', label: '하의', src: pants },
  { id: 'SKIRT', label: '스커트', src: skirt },
  { id: 'ACCESSORY', label: '패션잡화', src: accessory },
  { id: 'BEAUTY', label: '뷰티', src: beauty },
];
const imageModes = [
  { value: 'upload', label: '이미지 불러오기' },
  { value: 'template', label: '도안 고르기' },
] as const;
const won = new Intl.NumberFormat('ko-KR');

type ScreenProps = {
  url: string | null;
  api: ProductSaveApi;
  onClose: () => void | Promise<unknown>;
  onViewProduct?: (cardId: string) => Promise<unknown>;
  entryMode?: 'auto' | 'manual' | 'web';
  initialDraft?: InitialDraft;
  savedMessage?: string;
};

export function ScreenShell({
  children,
  onClose,
  busy,
  back,
}: {
  children: ReactNode;
  onClose: ScreenProps['onClose'];
  busy?: boolean;
  back?: boolean;
}) {
  const [closeError, setCloseError] = useState(false);
  const [closing, setClosing] = useState(false);
  async function close() {
    if (closing || busy) return;
    setClosing(true);
    setCloseError(false);
    try {
      await onClose();
    } catch {
      setClosing(false);
      setCloseError(true);
    }
  }
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <button
          className={styles.close}
          type="button"
          aria-label={back ? '뒤로 가기' : '닫기'}
          disabled={busy || closing}
          onClick={() => void close()}
        >
          <Icon name={back ? 'chevron-left-line' : 'xmark-line'} />
        </button>
        <h1 className={styles.title}>상품 저장</h1>
      </header>
      <div className={styles.body}>
        {closeError && (
          <p className={styles.error} role="alert">
            화면을 닫지 못했어요. 다시 시도해 주세요.
          </p>
        )}
        {children}
      </div>
    </main>
  );
}

type Ready = Extract<ProductLookup, { status: 'ready' }>;
type ScreenData =
  | Ready
  | { status: 'loading' | 'error' | 'duplicate' | 'unsupported' | 'auth-required' };

const authMessage = '로그인한 뒤 상품을 저장할 수 있어요.';
const saveErrors = {
  duplicate: '이미 저장한 상품 링크예요.',
  failed: '저장하지 못했어요. 다시 시도해 주세요.',
  unknown: '저장 결과를 확인할 수 없어요. 다시 저장하기 전 보드를 확인해 주세요.',
  'auth-required': authMessage,
} satisfies Record<
  Extract<ProductSaveResult, { status: 'rejected' }>['reason'] | 'unknown',
  string
>;
type InitialDraft = {
  name?: string;
  memo: string;
  image: CardImage | null;
  tags: string[];
  boardIds: string[];
};

export function ProductSaveScreen({
  url,
  api,
  paused = false,
  ...formProps
}: ScreenProps & { paused?: boolean }) {
  const { onClose } = formProps;
  const [loaded, setLoaded] = useState<ScreenData>({ status: 'loading' });
  const [attempt, retry] = useState(0);
  // Resume only unfinished lookups; a completed form keeps its fields and edits.
  const pausedLookup = paused && loaded.status === 'loading';
  useEffect(() => {
    if (!url || pausedLookup) return;
    const request = new AbortController();
    const { signal } = request;
    const load = async () => {
      try {
        const lookup = await api.lookup(url, signal);
        if (!signal.aborted) setLoaded(lookup);
      } catch {
        if (!signal.aborted) setLoaded({ status: 'error' });
      }
    };
    void load();
    return () => request.abort();
  }, [api, url, attempt, pausedLookup]);

  if (!url)
    return (
      <ScreenShell onClose={onClose}>
        <UnsupportedLink />
      </ScreenShell>
    );
  if (loaded.status === 'ready')
    return <ProductForm {...formProps} lookup={loaded} sourceURL={url} api={api} />;
  return (
    <ScreenShell onClose={onClose}>
      {loaded.status === 'unsupported' && <UnsupportedLink />}
      {loaded.status === 'duplicate' && <p role="alert">{saveErrors.duplicate}</p>}
      {loaded.status === 'auth-required' && <p role="status">{authMessage}</p>}
      {loaded.status === 'loading' && (
        <p role="status">
          {formProps.entryMode === 'auto'
            ? '쇼핑몰에서 상품 정보를 가져오는 중이에요.'
            : '상품 링크를 확인하는 중이에요.'}
        </p>
      )}
      {loaded.status === 'error' && (
        <>
          <p role="alert">상품 정보를 불러오지 못했어요.</p>
          <Button
            onClick={() => {
              setLoaded({ status: 'loading' });
              retry((n) => n + 1);
            }}
          >
            다시 시도
          </Button>
        </>
      )}
    </ScreenShell>
  );
}

function UnsupportedLink() {
  return (
    <p role="status">지원하지 않는 상품 링크예요. 쇼핑몰의 상품 페이지에서 다시 공유해 주세요.</p>
  );
}

function SharedLink({ url }: { url: string }) {
  return (
    <TextField className={styles.linkField} variant="box" label="상품 링크" value={url} readOnly />
  );
}

function ProductForm({
  lookup,
  sourceURL,
  api,
  onClose,
  onViewProduct,
  entryMode,
  initialDraft,
  savedMessage = '보드에 상품을 저장했어요.',
}: Omit<ScreenProps, 'url'> & {
  lookup: Ready;
  sourceURL: string;
}) {
  const { url, shop, product } = lookup;
  const linkedImage = product?.imageURL;
  const manualHint =
    entryMode === 'web'
      ? '웹에서는 자동 입력을 지원하지 않아요. 상품 정보를 직접 입력해 주세요.'
      : entryMode === 'auto'
        ? '상품 정보를 자동으로 가져오지 못했어요. 직접 입력해서 저장할 수 있어요.'
        : entryMode === 'manual'
          ? '이 링크는 자동 입력을 지원하지 않아요. 직접 입력해서 저장할 수 있어요.'
          : null;
  const [name, setName] = useState(product?.name || initialDraft?.name || '');
  const [price, setPrice] = useState(product?.price != null ? won.format(product.price) : '');
  const [selectedImage, setImage] = useState<CardImage | null>(
    linkedImage ? { kind: 'linked-product', url: linkedImage } : (initialDraft?.image ?? null),
  );
  const {
    attempt,
    status: imageStatus,
    loading: loadingImage,
    settle: settleImage,
  } = useLinkedImage(linkedImage);
  const linkedImageSelected =
    selectedImage?.kind === 'linked-product' && selectedImage.url === linkedImage;
  const image = linkedImageSelected && imageStatus !== 'ready' ? null : selectedImage;
  const [memo, setMemo] = useState(initialDraft?.memo ?? '');
  const [tags, setTags] = useState(initialTags);
  const [selectedTags, setSelectedTags] = useState(initialDraft?.tags ?? []);
  const [tag, setTag] = useState<string | null>(null);
  const [loadedBoards, retryBoards, updateBoards] = useLoad(
    (signal) => api.listBoards(signal),
    [api],
    { timeoutMs: 8_000 },
  );
  const boards = loadedBoards.status === 'ready' ? loadedBoards.value : loadedBoards.status;
  const [selectedBoards, setSelectedBoards] = useState(initialDraft?.boardIds ?? []);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [boardError, setBoardError] = useState(false);
  const [pending, setPending] = useState<'board' | 'save' | null>(null);
  const [saveResult, setSaveResult] = useState<ProductSaveResult | null>(null);
  const [opening, setOpening] = useState<'idle' | 'busy' | 'error'>('idle');
  const boardList = useRef<HTMLUListElement>(null);
  const focusTrigger = useRef<'tag' | 'board' | null>(null);
  const busy = useRef(false);
  const tagName = tag === null ? undefined : normalizeTag(tag);
  const newBoardName = boardName?.trim();
  const canAddTag = Boolean(tagName && !tags.includes(tagName));
  const canCreateBoard = Boolean(
    newBoardName &&
    typeof boards !== 'string' &&
    !boards.some((board) => board.name === newBoardName),
  );
  const numericPrice = parseWholeWon(price);
  const invalidPrice = numericPrice === null;
  const invalidName = codePointLength(name.trim()) > productLimits.titleLength;
  const canSave = Boolean(
    name.trim() &&
    !invalidName &&
    !invalidPrice &&
    image &&
    selectedTags.length &&
    typeof boards !== 'string' &&
    selectedBoards.length &&
    // Only a confirmed no-effect failure may be submitted again.
    (!saveResult || (saveResult.status === 'rejected' && saveResult.reason === 'failed')),
  );
  const saveError =
    saveResult?.status === 'rejected'
      ? saveErrors[saveResult.reason]
      : saveResult?.status === 'unknown' && saveErrors.unknown;

  function toggle(selection: string[], value: string) {
    return selection.includes(value)
      ? selection.filter((item) => item !== value)
      : [...selection, value];
  }
  function closeTagEntry() {
    focusTrigger.current = 'tag';
    setTag(null);
  }
  function closeBoardEntry() {
    focusTrigger.current = 'board';
    setBoardError(false);
    setBoardName(null);
  }
  function restoreTrigger(kind: 'tag' | 'board', button: HTMLButtonElement | null) {
    if (button && focusTrigger.current === kind) {
      focusTrigger.current = null;
      button.focus();
    }
  }
  function addTag() {
    if (!tagName || !canAddTag) return;
    setTags([...tags, tagName]);
    setSelectedTags([...selectedTags, tagName]);
    closeTagEntry();
  }
  async function createBoard() {
    if (!newBoardName || !canCreateBoard || busy.current) return;
    busy.current = true;
    setPending('board');
    setBoardError(false);
    try {
      const board = await api.createBoard(newBoardName);
      updateBoards((list) => [board, ...list]);
      setSelectedBoards((list) => [...list, board.id]);
      closeBoardEntry();
      boardList.current?.scrollTo(0, 0);
    } catch {
      setBoardError(true);
    } finally {
      setPending(null);
      busy.current = false;
    }
  }

  async function save() {
    if (!canSave || !image || numericPrice === null || busy.current) return;
    busy.current = true;
    setPending('save');
    setSaveResult(null);
    try {
      setSaveResult(
        await api.save({
          url,
          sharedUrl: sourceURL === url ? null : sourceURL,
          shop,
          name: name.trim(),
          price: numericPrice,
          metadataSource: product ? 'CLIENT' : 'MANUAL',
          image,
          tags: selectedTags,
          memo: memo.trim(),
          boardIds: selectedBoards,
        }),
      );
    } catch {
      setSaveResult(unknownOutcome);
    } finally {
      setPending(null);
      busy.current = false;
    }
  }

  if (saveResult?.status === 'done') {
    return (
      <ScreenShell onClose={onClose} busy={opening === 'busy'}>
        <Toast>{savedMessage}</Toast>
        {onViewProduct && (
          <footer className={styles.footer}>
            {opening === 'error' && <p role="alert">상품 상세를 열지 못했어요.</p>}
            <Button
              loading={opening === 'busy'}
              onClick={async () => {
                setOpening('busy');
                try {
                  await onViewProduct(saveResult.value.cardId);
                } catch {
                  setOpening('error');
                }
              }}
            >
              상품 상세 보기
            </Button>
          </footer>
        )}
      </ScreenShell>
    );
  }
  return (
    <ScreenShell onClose={onClose} busy={pending !== null}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className={styles.fields}>
          <SharedLink url={url} />
          {!product && manualHint && (
            <p className={styles.feedback} role="status">
              {manualHint}
            </p>
          )}
          {product && (
            <div className={styles.productCard}>
              {linkedImage && imageStatus !== 'failed' && (
                <img
                  key={attempt}
                  className={styles.productImage}
                  src={linkedImage}
                  alt=""
                  referrerPolicy="no-referrer"
                  onLoad={() => settleImage(attempt, true)}
                  onError={() => settleImage(attempt, false)}
                />
              )}
              <div className={styles.productInfo}>
                <p className={styles.feedback}>
                  {loadingImage
                    ? '상품 이미지를 불러오는 중이에요.'
                    : product.name &&
                        product.price !== null &&
                        linkedImage &&
                        imageStatus === 'ready'
                      ? '자동으로 가져온 정보예요. 저장 전에 확인해 주세요.'
                      : '일부 정보만 가져왔어요. 비어 있는 항목을 입력해 주세요.'}
                </p>
                {linkedImage && imageStatus === 'failed' && (
                  <p className={styles.feedback}>
                    상품 이미지를 불러오지 못했어요. 직접 추가해 주세요.
                  </p>
                )}
                {linkedImage &&
                  imageStatus === 'ready' &&
                  (linkedImageSelected ? (
                    <span className={styles.feedback}>상품 이미지 사용 중</span>
                  ) : (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => setImage({ kind: 'linked-product', url: linkedImage })}
                    >
                      상품 이미지 사용
                    </Button>
                  ))}
              </div>
            </div>
          )}
          <TextField
            label="상품명"
            variant="box"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onClear={() => setName('')}
            error={invalidName && titleLengthMessage}
            required
          />
          <TextField
            label="가격"
            variant="box"
            value={price}
            inputMode="numeric"
            placeholder="ex)10,000원"
            error={Boolean(price.trim()) && invalidPrice && priceRangeMessage}
            onChange={(event) => setPrice(event.target.value)}
            onBlur={() => {
              if (!invalidPrice && numericPrice !== null) setPrice(won.format(numericPrice));
            }}
            onClear={() => setPrice('')}
            required
          />
          <CardImagePicker image={image} setImage={setImage} />
          <section className={styles.group} aria-label="해시태그">
            <p className={styles.label}>해시태그 (1개 이상)</p>
            <div className={styles.tags}>
              {tags.map((value) => (
                <span className={styles.customTag} key={value}>
                  <ChipFilter
                    selected={selectedTags.includes(value)}
                    onClick={() => setSelectedTags(toggle(selectedTags, value))}
                  >
                    {value}
                  </ChipFilter>
                  {!initialTags.includes(value) && (
                    <button
                      type="button"
                      className={styles.removeTag}
                      aria-label={value + ' 해시태그 삭제'}
                      onClick={() => {
                        setTags(tags.filter((item) => item !== value));
                        setSelectedTags(selectedTags.filter((item) => item !== value));
                      }}
                    >
                      <Icon name="xmark-circle-fill" size={16} />
                    </button>
                  )}
                </span>
              ))}
              {tag === null && (
                <ChipFilter
                  className={styles.addTag}
                  ref={(button) => restoreTrigger('tag', button)}
                  aria-pressed={undefined}
                  onClick={() => setTag('')}
                >
                  +직접 추가
                </ChipFilter>
              )}
            </div>
            {tag !== null && (
              <InlineEntry
                label="새 해시태그"
                value={tag}
                maxLength={productLimits.tagLength}
                action="추가"
                disabled={!canAddTag}
                onChange={setTag}
                onConfirm={addTag}
                onCancel={closeTagEntry}
              />
            )}
          </section>
          <TextField
            label="한 줄 메모(선택)"
            variant="box"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            onClear={() => setMemo('')}
            maxLength={productLimits.memoLength}
          />
          <section className={styles.group} aria-label="보드 선택">
            <p className={styles.label}>보드 선택 (1개 이상)</p>
            <div className={styles.boardPanel}>
              {boards === 'loading' ? (
                <p className={styles.feedback} role="status">
                  보드를 불러오는 중이에요.
                </p>
              ) : boards === 'error' ? (
                <>
                  <p className={styles.error} role="alert">
                    보드를 불러오지 못했어요.
                  </p>
                  <Button variant="secondary" size="small" onClick={retryBoards}>
                    보드 다시 불러오기
                  </Button>
                </>
              ) : (
                <>
                  {boards.length > 0 ? (
                    <ul className={styles.boardList} ref={boardList}>
                      {boards.map((board) => (
                        <li className={styles.boardRow} key={board.id}>
                          <Checkbox
                            className={styles.boardCheck}
                            checked={selectedBoards.includes(board.id)}
                            onChange={() => setSelectedBoards(toggle(selectedBoards, board.id))}
                          >
                            {board.name}
                            <span aria-hidden="true" className={styles.boardCount}>
                              {board.productCount}개
                            </span>
                          </Checkbox>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.feedback}>첫 보드를 만들어 주세요.</p>
                  )}
                  <div className={styles.boardActions}>
                    {boardName === null ? (
                      <button
                        type="button"
                        className={styles.addBoard}
                        ref={(button) => restoreTrigger('board', button)}
                        onClick={() => setBoardName('')}
                      >
                        <Icon name="plus-small-line" size={16} />새 보드 만들기
                      </button>
                    ) : (
                      <InlineEntry
                        label="새 보드 이름"
                        value={boardName}
                        maxLength={productLimits.boardNameLength}
                        action="완료"
                        variant="secondary"
                        placeholder="보드 이름"
                        helperText="최대 10자까지 입력 가능해요"
                        loading={pending === 'board'}
                        disabled={!canCreateBoard}
                        onChange={setBoardName}
                        onConfirm={() => void createBoard()}
                        onCancel={closeBoardEntry}
                      />
                    )}
                    {boardError && (
                      <p className={styles.error} role="alert">
                        보드를 만들지 못했어요.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
        <footer className={styles.footer}>
          {saveError && (
            <p className={styles.error} role="alert">
              {saveError}
            </p>
          )}
          <Button
            type="submit"
            loading={pending === 'save'}
            disabled={!canSave || pending !== null}
          >
            보드에 저장하기
          </Button>
        </footer>
      </form>
    </ScreenShell>
  );
}

function CardImagePicker({
  image,
  setImage,
}: {
  image: CardImage | null;
  setImage: (value: CardImage | null) => void;
}) {
  const [mode, setMode] = useState<'upload' | 'template'>(
    image?.kind === 'upload' ? 'upload' : 'template',
  );
  const previous = useRef<Partial<Record<typeof mode, CardImage | null>>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [invalidImage, setInvalidImage] = useState(false);
  const file = image?.kind === 'upload' ? image.file : null;
  useEffect(() => {
    if (!file) return;
    const objectURL = URL.createObjectURL(file);
    setPreviewURL(objectURL);
    return () => URL.revokeObjectURL(objectURL);
  }, [file]);
  return (
    <section className={styles.group} aria-label="카드 이미지">
      <p className={styles.label}>카드 이미지 (필수)</p>
      <SegmentedControl
        className={styles.imageModes}
        items={[...imageModes]}
        value={mode}
        onChange={(next) => {
          if (next === mode) return;
          previous.current[mode] = image;
          setMode(next);
          setImage(previous.current[next] ?? null);
          setInvalidImage(false);
        }}
      />
      {mode === 'template' ? (
        <div className={styles.cardOptions}>
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={styles.cardOption}
              aria-pressed={image?.kind === 'template' && image.id === template.id}
              onClick={() => setImage({ kind: 'template', id: template.id })}
            >
              <img className={styles.template} src={template.src} alt="" />
              {template.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <input
            type="file"
            ref={fileInput}
            hidden
            aria-label="카드 이미지 파일"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const next = event.currentTarget.files?.[0];
              if (!next) return;
              event.currentTarget.value = '';
              if (
                !['image/jpeg', 'image/png', 'image/webp'].includes(next.type) ||
                next.size === 0 ||
                next.size > 5 * 1024 * 1024
              ) {
                setInvalidImage(true);
                return;
              }
              setInvalidImage(false);
              setImage({ kind: 'upload', file: next });
            }}
          />
          <Button size="medium" variant="secondary" onClick={() => fileInput.current?.click()}>
            {file ? '이미지 변경' : '이미지 선택'}
          </Button>
          {file && previewURL && (
            <div className={styles.uploadPreview}>
              <img className={styles.productImage} src={previewURL} alt="카드 이미지 미리보기" />
              <span className={styles.feedback}>{file.name}</span>
            </div>
          )}
          {invalidImage && (
            <p className={styles.error} role="alert">
              5MB 이하의 JPG, PNG, WebP 이미지를 선택해 주세요.
            </p>
          )}
        </>
      )}
    </section>
  );
}
