import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { ArchivePost } from './entities/archivePost.entity';
import { Comment } from './entities/comment.entity';
import { Tag } from './entities/tag.entity';
import { Game } from '../auth/entities/game.entity';
import { PostsController } from './posts.controller';
import PostsService from './posts.service';

@Module({
    imports: [
        AiModule,
        TypeOrmModule.forFeature([ArchivePost, Comment, Game, Tag]),
    ],
    controllers: [PostsController],
    providers: [PostsService],
})
export class PostsModule {}
