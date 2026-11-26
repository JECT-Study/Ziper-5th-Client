import { useEffect, useRef, useState } from 'react';
import { providers, type Provider } from '@ziper/bridge/contract';
import { errorMessage } from '../../../../shared/api/http';
import { useOAuthCodeLoginMutation } from '../../api/queries';
import { saveLastProvider } from '../../model/lastProvider';
import { consumeState, redirectUriOf } from '../../model/webOAuth';

const FAILED = '로그인하지 못했어요. 다시 시도해주세요';

type Result =
  | { status: 'pending' }
  | { status: 'cancelled' }
  | { status: 'signedIn' | 'signupRequired' }
  | { status: 'failed'; message: string };

/** 웹 소셜 로그인에서 돌아온 주소의 인가 코드를 백엔드로 보내 로그인한다. 결과만 돌려준다. */
export function useOAuthCodeExchange(provider: string): Result {
  const login = useOAuthCodeLoginMutation();
  // 주소만 보고 판단한 결과(취소·잘못된 요청). 백엔드에 보낸 결과는 login 이 들고 있다.
  const [early, setEarly] = useState<Result | null>(null);
  // 인가 코드는 한 번만 쓸 수 있어서, 개발 모드에서 effect 가 두 번 돌아도 한 번만 보낸다.
  const started = useRef(false);
  const { mutate } = login;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    // 사용자가 동의 화면에서 취소하면 code 없이 error 만 돌아온다.
    if (params.get('error') && !code) return setEarly({ status: 'cancelled' });

    const knownProvider = (providers as readonly string[]).includes(provider);
    if (!knownProvider || !code || !state || !consumeState(provider as Provider, state))
      return setEarly({ status: 'failed', message: FAILED });

    mutate(
      { provider, code, state, redirectUri: redirectUriOf(provider as Provider) },
      { onSuccess: () => saveLastProvider(provider) },
    );
  }, [provider, mutate]);

  if (early) return early;
  if (login.isSuccess) return { status: login.data.status };
  if (login.isError) return { status: 'failed', message: errorMessage(login.error, FAILED) };
  return { status: 'pending' };
}
