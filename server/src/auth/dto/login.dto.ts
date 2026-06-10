// 로그인 요청 데이터 검사를 위해 class-validator 기능을 가져옵니다.
import { IsEmail, IsString, MinLength } from 'class-validator';

// LoginDto는 로그인 요청 body의 모양을 정의합니다.
export class LoginDto {
  // 이메일을 로그인 ID처럼 사용하므로 이메일 형식인지 검사합니다.
  @IsEmail()
  email!: string;

  // 비밀번호는 문자열이고 최소 8글자 이상이어야 합니다.
  @IsString()
  @MinLength(8)
  password!: string;
}
