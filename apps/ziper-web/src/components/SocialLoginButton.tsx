import type { ButtonHTMLAttributes } from 'react';
import appleLogo from '../assets/social/apple-logo.svg';
import kakaoLogo from '../assets/social/kakao-logo.svg';
import naverLogo from '../assets/social/naver-logo.svg';
import { cx } from './cx';
import * as styles from './SocialLoginButton.css';

export type SocialProvider = 'naver' | 'kakao' | 'apple';

const PROVIDERS = {
  naver: { logo: naverLogo, label: '네이버 로그인' },
  kakao: { logo: kakaoLogo, label: '카카오로 로그인' },
  apple: { logo: appleLogo, label: 'Apple로 로그인' },
} satisfies Record<SocialProvider, { logo: string; label: string }>;

type SocialLoginButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  provider: SocialProvider;
};

/** 네이버·카카오·Apple 로그인 버튼. children 을 주면 기본 문구 대신 쓴다. */
export function SocialLoginButton({
  provider,
  children,
  className,
  type = 'button',
  ...rest
}: SocialLoginButtonProps) {
  const { logo, label } = PROVIDERS[provider];
  return (
    <button type={type} className={cx(styles.button[provider], className)} {...rest}>
      <img className={styles.logo[provider]} src={logo} alt="" />
      {children ?? label}
    </button>
  );
}
