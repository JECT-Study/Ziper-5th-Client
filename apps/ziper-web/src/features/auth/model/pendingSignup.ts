// 소셜 신규 가입자의 가입 토큰. 약관 화면에서 새로고침해도 이어지도록 이 탭의 sessionStorage 에 둔다.
// 백엔드가 10분 뒤 만료시키므로 오래 남아도 쓸 수 없다. 가입하거나 화면을 떠나면 지운다.
const KEY = 'ziper:signupToken';

export const savePendingSignup = (signupToken: string) => sessionStorage.setItem(KEY, signupToken);
export const loadPendingSignup = () => sessionStorage.getItem(KEY);
export const clearPendingSignup = () => sessionStorage.removeItem(KEY);
