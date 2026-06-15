// class-validator
import { 
  IsNotEmpty,
  IsString,
} from 'class-validator';

// UpdateCommentDto 요청 body의 모양을 정의합니다.
export default class UpdateCommentDto {
    @IsString()
    @IsNotEmpty()
    content!: string;
}
