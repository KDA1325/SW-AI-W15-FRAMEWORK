// class-validator는 요청 데이터가 올바른 형식인지 검사할 때 사용합니다.
import { IsEmail, IsString, MinLength } from 'class-validator';

// RegisterDto는 회원가입 요청 body의 모양을 정의합니다.
export class RegisterDto {
  // email 값이 이메일 형식인지 검사합니다.
  @IsEmail()
  email!: string;

  // nickname 값이 문자열인지 검사하고, 최소 2글자 이상인지 확인합니다.
  @IsString()
  @MinLength(2)
  nickname!: string;

  // password 값이 문자열인지 검사하고, 최소 8글자 이상인지 확인합니다.
  @IsString()
  @MinLength(8)
  password!: string;
}
