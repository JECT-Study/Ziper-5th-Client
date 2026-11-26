import { createFileRoute, useRouter } from '@tanstack/react-router';
import { findSharedURL } from '@ziper/product-extraction/link';
import { useState, type SubmitEvent } from 'react';
import { usePlatform } from '../bridge/provider';
import { Button, TextField } from '../components';
import { ConnectedProductSave } from '../features/product-save/connected-product-save';
import { ScreenShell } from '../features/product-save/product-save-screen';
import * as saveStyles from '../features/product-save/product-save.css';
import * as styles from '../features/product-save/register-product.css';

export const Route = createFileRoute('/register-product')({
  validateSearch: (search: Record<string, unknown>) => ({
    step: search.step === 'details' ? ('details' as const) : undefined,
  }),
  component: RegisterProduct,
});

function RegisterProduct() {
  const { step } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const { platform, status } = usePlatform();
  const [draft, setDraft] = useState('');
  const [submittedURL, setSubmittedURL] = useState<string | null>(null);
  const [validationVisible, setValidationVisible] = useState(false);
  const [transition, setTransition] = useState<'idle' | 'opening' | 'error'>('idle');
  const url = findSharedURL(draft);

  function updateDraft(value: string) {
    setDraft(value);
    setSubmittedURL(null);
    setValidationVisible(false);
    setTransition('idle');
  }

  async function next(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (transition === 'opening') return;
    if (!url) {
      setValidationVisible(true);
      return;
    }

    setTransition('opening');
    try {
      // A stale details URL needs an input entry to return to.
      if (step === 'details') {
        await navigate({ search: { step: undefined }, replace: true });
      }
      setSubmittedURL(url);
      await navigate({ search: { step: 'details' } });
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
    return (
      <ConnectedProductSave
        key={submittedURL}
        url={submittedURL}
        onClose={close}
        onViewProduct={(cardId) => platform.navigation.replace('/products/' + cardId)}
      />
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
            <p className={styles.description}>
              {status === 'web'
                ? '웹에서는 링크를 붙여넣은 뒤 상품 정보를 직접 입력해 주세요.'
                : '쇼핑몰 상품 페이지의 주소를 입력해 주세요.'}
            </p>
          </div>
          <TextField
            variant="box"
            className={saveStyles.linkField}
            label="상품 링크"
            type="url"
            inputMode="url"
            enterKeyHint="go"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            readOnly={transition === 'opening'}
            placeholder="https://"
            value={draft}
            error={validationVisible && !url && '올바른 상품 링크를 입력해 주세요.'}
            onBlur={() => setValidationVisible(Boolean(draft.trim()))}
            onPaste={(event) => {
              const pastedURL = findSharedURL(event.clipboardData.getData('text'));
              if (!pastedURL) return;
              event.preventDefault();
              updateDraft(pastedURL);
            }}
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
          <Button type="submit" disabled={!draft.trim()} loading={transition === 'opening'}>
            {status === 'web' ? '직접 입력하기' : '상품 정보 입력하기'}
          </Button>
        </footer>
      </form>
    </ScreenShell>
  );
}
