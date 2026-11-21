// Figma 노트 "닉네임 중복 확인 정책": 한글·영문·숫자 2~10자, 특수문자·공백 불가.
export const NICKNAME_MAX = 10;
export const isValidNickname = (value: string) => /^[가-힣a-zA-Z0-9]{2,10}$/.test(value);

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const EMAIL_CODE_LENGTH = 6;

// 백엔드 규칙: 영문·숫자·특수문자를 모두 포함한 8~64자, 공백 불가
export const isValidPassword = (value: string) =>
  value.length >= 8 &&
  value.length <= 64 &&
  !/\s/.test(value) &&
  /[a-zA-Z]/.test(value) &&
  /\d/.test(value) &&
  /[^a-zA-Z\d]/.test(value);
