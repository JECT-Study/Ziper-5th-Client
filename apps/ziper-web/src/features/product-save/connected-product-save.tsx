import { useState } from 'react';
import { isProductExtractionURL } from '@ziper/product-extraction/link';
import { usePlatform } from '../../bridge/provider';
import { ProductSaveScreen, ScreenShell } from './product-save-screen';

type Props = Pick<Parameters<typeof ProductSaveScreen>[0], 'url' | 'onClose' | 'onViewProduct'>;

export function ConnectedProductSave(props: Props) {
  const { platform, status } = usePlatform();
  const settled = status === 'closed' || status === 'initializing' ? null : status;
  // 숨겨진 문서는 브릿지를 놓을 뿐, 직접 입력으로 바뀐 게 아니다.
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
      extract={auto ? platform.extractProduct : null}
      entryMode={auto ? 'auto' : mode === 'web' ? 'web' : 'manual'}
    />
  );
}
