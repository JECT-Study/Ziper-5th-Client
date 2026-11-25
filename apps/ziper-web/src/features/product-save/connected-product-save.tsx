import { useMemo, useState } from 'react';
import { isProductExtractionURL } from '@ziper/product-extraction/link';
import { usePlatform } from '../../bridge/provider';
import { productSaveApi } from './product-save-api';
import { productSaveWithExtraction } from './product-extraction';
import { ProductSaveScreen, ScreenShell } from './product-save-screen';

type Props = Pick<Parameters<typeof ProductSaveScreen>[0], 'url' | 'onClose' | 'onViewProduct'>;

export function ConnectedProductSave(props: Props) {
  const { platform, status } = usePlatform();
  const nativeApi = useMemo(() => productSaveWithExtraction(platform.extractProduct), [platform]);
  const settled = status === 'closed' || status === 'initializing' ? null : status;
  // A hidden document releases its bridge. That isn't a switch to manual entry.
  const [mode, setMode] = useState(settled);
  if (settled && mode !== settled) setMode(settled);
  const auto = mode === 'native' && props.url && isProductExtractionURL(props.url, true);
  if (!mode)
    return (
      <ScreenShell onClose={props.onClose}>
        <p role="status">상품 링크를 확인하는 중이에요.</p>
      </ScreenShell>
    );
  return (
    <ProductSaveScreen
      key={mode}
      {...props}
      paused={!settled}
      api={auto ? nativeApi : productSaveApi}
      entryMode={auto ? 'auto' : mode === 'web' ? 'web' : 'manual'}
    />
  );
}
