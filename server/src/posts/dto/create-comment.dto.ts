import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export default class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
