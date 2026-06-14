// 로그인 요청 데이터 검사를 위해 class-validator 기능을 가져옵니다.
import { 
    IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min, 
} from 'class-validator';

import { ArchivePostType } from '../entities/archivePost.entity';

// CreatePostDto 로그인 요청 body의 모양을 정의합니다.
export default class CreatePostDto {
    // type!: 'JOURNAL' | 'REVIEW'
    @IsEnum(ArchivePostType)
    type!: ArchivePostType;

    @IsString()
    @IsNotEmpty()
    gameTitle!: string;
  
    @IsString()
    @IsNotEmpty()
    title!: string;

    @IsString()
    @IsNotEmpty()
    content!: string;
  
    // 포스트 타입에 따라 rating이 있을 수도, 없을 수도
    // JOURNAL은 rating 없음
    // REVIEW는 rating 있음
    @IsOptional() // 없어도 되는 필드라는 의미 
    @IsNumber() 
    @Min(1)
    @Max(5)
    rating?: number;
}
