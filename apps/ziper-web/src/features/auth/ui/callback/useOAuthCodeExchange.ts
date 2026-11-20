import { useEffect, useRef, useState } from 'react';
import { providers, type Provider } from '@ziper/bridge/contract';
import { errorMessage } from '../../../../shared/api/http';
import { signInWithOAuthCode } from '../../api/authApi';
import { saveLastProvider } from '../../model/lastProvider';
import { consumeState, redirectUriOf } from '../../model/webOAuth';

const FAILED = '로그인하지 못했어요. 다시 시도해주세요';

type Result =
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'signedIn'; isNewUser: boolean }
  | { status: 'failed'; message: string };

/** 웹 소셜 로그인에서 돌아온 주소의 인가 코드를 백엔드로 보내 로그인한다. 결과만 돌려준다. */
export function useOAuthCodeExchange(provider: string): Result {
  const [result, setResult] = useState<Result>({ status: 'pending' });
  // 인가 코드는 한 번만 쓸 수 있어서, 개발 모드에서 effect 가 두 번 돌아도 한 번만 보낸다.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    // 사용자가 동의 화면에서 취소하면 code 없이 error 만 돌아온다.
    if (params.get('error') && !code) return setResult({ status: 'cancelled' });

    const knownProvider = (providers as readonly string[]).includes(provider);
    if (!knownProvider || !code || !state || !consumeState(provider as Provider, state))
      return setResult({ status: 'failed', message: FAILED });

    signInWithOAuthCode(provider, { code, state, redirectUri: redirectUriOf(provider as Provider) })
      .then(({ isNewUser }) => {
        saveLastProvider(provider);
        setResult({ status: 'signedIn', isNewUser });
      })
      .catch((error) => setResult({ status: 'failed', message: errorMessage(error, FAILED) }));
  }, [provider]);

  return result;
}
