import { createFileRoute, useRouter } from '@tanstack/react-router';
import { isShareURL } from '@ziper/bridge/contract';
import { Suspense, useState, type SubmitEvent } from 'react';
import { usePlatform } from '../bridge/provider';
import { Button, TextField } from '../components';
import { ProductSavePreview, parsePreviewMode } from '../features/product-save/preview-config';
import { ProductSaveScreen, ScreenShell } from '../features/product-save/product-save-screen';
import * as saveStyles from '../features/product-save/product-save.css';
import * as styles from '../features/product-save/register-product.css';

export const Route = createFileRoute('/register-product')({
  validateSearch: (search: Record<string, unknown>) => {
    const preview = parsePreviewMode(search.preview);
    return {
      step: search.step === 'details' ? ('details' as const) : undefined,
      preview: preview === 'unsupported' ? undefined : preview,
    };
  },
  component: RegisterProduct,
});

function RegisterProduct() {
  const { step, preview } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { platform, status } = usePlatform();
  const [draft, setDraft] = useState('');
  const [submittedURL, setSubmittedURL] = useState<string | null>(null);
  const [validationVisible, setValidationVisible] = useState(false);
  const [transition, setTransition] = useState<'idle' | 'opening' | 'error'>('idle');
  const url = draft.trim();
  const invalidURL = !isShareURL(url);

  function updateDraft(value: string) {
    setDraft(value);
    setSubmittedURL(null);
    setValidationVisible(false);
    setTransition('idle');
  }

  async function next(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (transition === 'opening') return;
    if (invalidURL) {
      setValidationVisible(true);
      return;
    }

    setTransition('opening');
    try {
      // A stale details URL needs an input entry to return to.
      if (step === 'details') {
        await navigate({ search: { step: undefined, preview }, replace: true });
      }
      setSubmittedURL(url);
      await navigate({ search: { step: 'details', preview } });
      setTransition('idle');
    } catch {
      setTransition('error');
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
    return ProductSavePreview && preview ? (
      <Suspense
        fallback={
          <ScreenShell onClose={close}>
            <p role="status">상품 정보를 불러오는 중이에요.</p>
          </ScreenShell>
        }
      >
        <ProductSavePreview key={preview} mode={preview} url={submittedURL} onClose={close} />
      </Suspense>
    ) : (
      <ProductSaveScreen url={submittedURL} onClose={close} />
    );
  }

  return (
    <ScreenShell onClose={close} back busy={transition === 'opening'}>
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
            readOnly={transition === 'opening'}
            placeholder="https://"
            value={draft}
            error={validationVisible && invalidURL && '올바른 상품 링크를 입력해 주세요.'}
            onBlur={() => setValidationVisible(Boolean(url))}
            onChange={(event) => updateDraft(event.target.value)}
            onClear={() => updateDraft('')}
          />
        </div>
        <footer className={saveStyles.footer}>
          {transition === 'error' && (
            <p className={saveStyles.error} role="alert">
              다음 화면을 열지 못했어요. 다시 시도해 주세요.
            </p>
          )}
          <Button type="submit" disabled={!url} loading={transition === 'opening'}>
            상품 정보 입력하기
          </Button>
        </footer>
      </form>
    </ScreenShell>
  );
}
