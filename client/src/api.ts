// axios는 React에서 NestJS 서버로 HTTP 요청을 보내기 위한 라이브러리입니다.
import axios from 'axios';

// api는 서버 요청에 사용할 공통 설정입니다.
export const api = axios.create({
  // .env에 적은 VITE_API_URL 값을 서버 기본 주소로 사용합니다.
  // 예: /auth/login -> http://localhost:3000/auth/login
  baseURL: import.meta.env.VITE_API_URL,

  // 쿠키를 주고받기 위해 필요합니다.
  // 로그인 쿠키 access_token을 서버와 브라우저가 함께 사용합니다.
  withCredentials: true,
});