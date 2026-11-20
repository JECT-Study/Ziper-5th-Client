// 회원가입·이메일 로그인 API 자리. 백엔드 연동 전까지 화면 흐름을 확인하려고 가짜 응답을 돌려준다.
// TODO(백엔드 연동): 닉네임 중복 검사(JEC-46), 이메일 인증(JEC-43), 가입·로그인 API 로 바꾼다.

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

export async function isNicknameAvailable(nickname: string): Promise<boolean> {
  await wait();
  return nickname !== '우사기'; // Figma 예시의 "이미 사용 중" 닉네임
}

export async function sendEmailCode(email: string): Promise<void> {
  await wait();
  void email;
}

/** 가짜 응답에서는 123456 만 맞는 인증번호로 본다. */
export async function verifyEmailCode(email: string, code: string): Promise<boolean> {
  await wait();
  void email;
  return code === '123456';
}

export async function signUp(input: {
  nickname: string;
  email: string;
  password: string;
  marketingAgreed: boolean;
}): Promise<void> {
  await wait();
  void input;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await wait();
  void email;
  void password;
}
