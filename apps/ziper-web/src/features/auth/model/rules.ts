import * as v from 'valibot';

export const NICKNAME_MAX = 10;
export const EMAIL_CODE_LENGTH = 6;

// Figma 노트 "닉네임 중복 확인 정책": 한글·영문·숫자 2~10자, 특수문자·공백 불가.
export const nicknameSchema = v.pipe(
  v.string(),
  v.regex(/^[가-힣a-zA-Z0-9]{2,10}$/, '한글, 영문, 숫자 2~10자로 입력해주세요'),
);

export const emailSchema = v.pipe(
  v.string(),
  v.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '이메일 형식이 올바르지 않습니다'),
);

export const emailCodeSchema = v.pipe(v.string(), v.digits(), v.length(EMAIL_CODE_LENGTH));

// 백엔드 규칙: 영문·숫자·특수문자를 모두 포함한 8~64자, 공백 불가. 안내는 helperText 가 한다.
export const passwordSchema = v.pipe(
  v.string(),
  v.minLength(8, ''),
  v.maxLength(64, ''),
  v.regex(/^\S*$/, ''),
  v.regex(/[a-zA-Z]/, ''),
  v.regex(/\d/, ''),
  v.regex(/[^a-zA-Z\d]/, ''),
);

export const agreementsSchema = v.object({
  service: v.literal(true),
  privacy: v.literal(true),
  marketing: v.boolean(),
});

export const emailLoginSchema = v.object({
  email: emailSchema,
  password: v.pipe(v.string(), v.nonEmpty()),
});

export const signupPasswordSchema = v.pipe(
  v.object({
    password: passwordSchema,
    passwordConfirm: v.string(),
    agreements: agreementsSchema,
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['passwordConfirm']],
      ({ password, passwordConfirm }) => password === passwordConfirm,
      '비밀번호가 일치하지 않습니다',
    ),
    ['passwordConfirm'],
  ),
);
