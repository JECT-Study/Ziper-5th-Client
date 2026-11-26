import { createFileRoute, useRouter } from '@tanstack/react-router';
import { findSharedURL } from '@ziper/product-extraction/link';
import { useForm, useStore } from '@tanstack/react-form';
import { useState } from 'react';
import * as v from 'valibot';
import { usePlatform } from '../../../bridge/provider';
import { Button, TextField } from '../../../components';
import { ConnectedProductSave } from '../../../features/product-save/connected-product-save';
import { ScreenShell } from '../../../features/product-save/product-save-screen';
import * as saveStyles from '../../../features/product-save/product-save.css';
import * as styles from '../../../features/product-save/register-product.css';

const linkSchema = v.object({
  url: v.pipe(
    v.string(),
    v.transform(findSharedURL),
    v.string('올바른 상품 링크를 입력해 주세요.'),
  ),
});

export const Route = createFileRoute('/_app/products/new')({
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
  const [submittedURL, setSubmittedURL] = useState<string | null>(null);
  // 입력 중에는 오류를 숨기고, 입력을 마치거나 제출할 때만 보여 준다.
  const [validationVisible, setValidationVisible] = useState(false);
  const [transition, setTransition] = useState<'idle' | 'opening' | 'error'>('idle');
  const form = useForm({
    defaultValues: { url: '' },
    validators: { onChange: linkSchema },
    onSubmitInvalid: () => setValidationVisible(true),
    onSubmit: async ({ value }) => {
      const { url } = v.parse(linkSchema, value);
      setTransition('opening');
      try {
        // 오래된 상세 주소에는 돌아갈 입력 화면이 필요하다.
        if (step === 'details') {
          await navigate({ search: { step: undefined }, replace: true });
        }
        setSubmittedURL(url);
        await navigate({ search: { step: 'details' } });
        setTransition('idle');
      } catch {
        setTransition('error');
      }
    },
  });
  const draft = useStore(form.store, (state) => state.values.url);

  function updateDraft(value: string) {
    form.setFieldValue('url', value);
    setSubmittedURL(null);
    setValidationVisible(false);
    setTransition('idle');
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
      <form
        className={saveStyles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (transition !== 'opening') void form.handleSubmit();
        }}
      >
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
          <form.Field name="url">
            {(field) => (
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
                value={field.state.value}
                error={(validationVisible && field.state.meta.errors[0]?.message) || undefined}
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
            )}
          </form.Field>
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
