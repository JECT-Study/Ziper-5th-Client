import { createFileRoute, useRouter } from '@tanstack/react-router';
import { isShareURL } from '@ziper/bridge/contract';
import { lazy, Suspense, useState, type FormEvent } from 'react';
import { usePlatform } from '../bridge/provider';
import { Button, TextField } from '../components';
import { ProductSaveScreen, ScreenShell } from '../features/product-save/product-save-screen';
import * as saveStyles from '../features/product-save/product-save.css';
import * as styles from '../features/product-save/register-product.css';

const Preview = import.meta.env.DEV ? lazy(() => import('../features/product-save/preview')) : null;

export const Route = createFileRoute('/register-product')({
  validateSearch: (search: Record<string, unknown>) => ({
    step: search.step === 'details' ? ('details' as const) : undefined,
    preview:
      import.meta.env.DEV &&
      typeof search.preview === 'string' &&
      /^(auto|manual|offline|auth|duplicate|failed|unknown)$/.test(search.preview)
        ? search.preview
        : undefined,
  }),
  component: RegisterProduct,
});

function RegisterProduct() {
  const { step, preview } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { platform, status } = usePlatform();
  const [draft, setDraft] = useState('');
  const [submittedURL, setSubmittedURL] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  const [navigationError, setNavigationError] = useState(false);
  const url = draft.trim();

  async function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isShareURL(url)) {
      setShowError(true);
      return;
    }

    setNavigationError(false);
    try {
      // A reload or direct URL has no in-memory draft; recreate the entry before advancing.
      if (step === 'details') {
        await navigate({ search: { step: undefined, preview }, replace: true });
      }
      setSubmittedURL(url);
      await navigate({ search: { step: 'details', preview } });
    } catch {
      setNavigationError(true);
    }
  }

  function close() {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    return status === 'native'
      ? platform.navigation.back()
      : router.navigate({ to: '/', replace: true });
  }

  if (step === 'details' && submittedURL) {
    return Preview && preview ? (
      <Suspense
        fallback={
          <ScreenShell onClose={close}>
            <p role="status">상품 정보를 불러오는 중이에요.</p>
          </ScreenShell>
        }
      >
        <Preview mode={preview} url={submittedURL} onClose={close} />
      </Suspense>
    ) : (
      <ProductSaveScreen url={submittedURL} onClose={close} />
    );
  }

  return (
    <ScreenShell onClose={close} back>
      <form className={saveStyles.form} noValidate onSubmit={(event) => void next(event)}>
        <div className={saveStyles.fields}>
          <div className={styles.intro}>
            <h2 className={styles.heading}>
              마음에 든 상품의
              <br />
              링크를 붙여넣어 주세요
            </h2>
            <p className={styles.description}>쇼핑몰 상품 페이지의 주소를 입력해 주세요.</p>
          </div>
          <TextField
            variant="box"
            className={saveStyles.linkField}
            label="상품 링크"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            value={draft}
            error={showError && '올바른 상품 링크를 입력해 주세요.'}
            onBlur={() => setShowError(Boolean(url) && !isShareURL(url))}
            onChange={(event) => {
              setDraft(event.target.value);
              setSubmittedURL(null);
              setShowError(false);
            }}
            onClear={() => {
              setDraft('');
              setSubmittedURL(null);
              setShowError(false);
            }}
          />
        </div>
        <footer className={saveStyles.footer}>
          {navigationError && (
            <p className={saveStyles.error} role="alert">
              다음 화면을 열지 못했어요. 다시 시도해 주세요.
            </p>
          )}
          <Button type="submit" disabled={!url}>
            상품 정보 입력하기
          </Button>
        </footer>
      </form>
    </ScreenShell>
  );
}
