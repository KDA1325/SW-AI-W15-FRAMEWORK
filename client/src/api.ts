// axios는 React에서 NestJS 서버로 HTTP 요청을 보내기 위한 라이브러리입니다.
import axios from 'axios';

// api는 서버 요청에 사용할 공통 설정입니다.
export const api = axios.create({
  // .env에 적은 VITE_API_URL 값을 서버 기본 주소로 사용합니다.
  // 예: /auth/login -> http://localhost:3000/auth/login
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',

  // 쿠키를 주고받기 위해 필요합니다.
  // 로그인 쿠키 access_token을 서버와 브라우저가 함께 사용합니다.
  withCredentials: true,
});

// 서버의 공통 에러 응답 모양입니다.
// message는 화면에 바로 보여줄 대표 메시지이고, errors는 ValidationPipe 상세 메시지 목록입니다.
type ApiErrorResponse = {
  message?: unknown;
  errors?: unknown;
};

// unknown은 catch로 받은 에러처럼 타입을 확신할 수 없는 값에 붙이는 TypeScript 타입입니다.
// 이 함수 하나에서만 Axios 에러 구조를 해석하면, 화면마다 같은 기준으로 사용자 메시지를 만들 수 있습니다.
export function getApiErrorMessage(
  error: unknown,
  fallbackMessage = 'REQUEST FAILED',
) {
  // axios.isAxiosError는 "이 에러가 axios 요청 실패에서 온 것인지" 확인하는 타입 가드입니다.
  // 타입 가드는 if문 안에서 TypeScript가 error의 타입을 더 구체적으로 좁혀 알게 해주는 문법입니다.
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fallbackMessage;
  }

  // response가 없다는 것은 서버가 에러 JSON을 준 것이 아니라 네트워크 연결 자체가 실패한 상황입니다.
  if (!error.response) {
    return 'SERVER CONNECTION FAILED';
  }

  const responseMessage = error.response.data?.message;
  const responseErrors = error.response.data?.errors;

  if (typeof responseMessage === 'string') {
    return responseMessage.toUpperCase();
  }

  if (Array.isArray(responseErrors)) {
    return responseErrors
      .filter((item): item is string => typeof item === 'string')
      .join(' / ')
      .toUpperCase();
  }

  return fallbackMessage;
}
