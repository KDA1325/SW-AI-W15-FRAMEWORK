// 로그인 요청 데이터 검사를 위해 class-validator 기능을 가져옵니다.
import { 
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min, 
} from 'class-validator';

// UpdatePostDto 로그인 요청 body의 모양을 정의합니다.
export default class UpdatePostDto {
    // type은 게시글 작성 때 정해지기 때문에 업데이트에선 몰라도 됨
    // 모든 요소들을 !로 두면 내용 수정할 때 내가 수정하지 않은 기존 내용들까지 전부 다시 DB에 PATCH하게 되어서 사실상 PUT이랑 다를 게 없게 됨
    // 모든 요소들을 ?로 두면 내용 수정된 요소만 DB에 PATCH됨 

    // ? = TS 타입 문법 -> 코드 작성할 때 해당 요소가 없을 수도 있다 => 컴파일 단계에서만 영향을 줌 
    // @IsOptional = 런타임 요청 검증용 데코레이터 -> 실제 API 요청 body에 해당 요소가 없으면 검증을 건너뛰어라 -> 서버가 실제 요청을 받을 때 검증 건너뛰기
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    gameTitle?: string;
    
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    title?: string;
    
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    content?: string;
  
    // 포스트 타입에 따라 rating이 있을 수도, 없을 수도
    // JOURNAL은 rating 없음
    // REVIEW는 rating 있음
    @IsOptional() // 없어도 되는 필드라는 의미 
    @IsNumber() 
    @Min(1)
    @Max(5)
    rating?: number;
}
