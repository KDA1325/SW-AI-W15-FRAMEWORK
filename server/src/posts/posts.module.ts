import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchivePost } from './entities/archivePost.entity';
import { Game } from '../auth/entities/game.entity';
import { PostsController } from './posts.controller';
import PostsService from './posts.service';

@Module({
    imports: [TypeOrmModule.forFeature([ArchivePost, Game])],
    controllers: [PostsController],
    providers: [PostsService],
})

export class PostsModule {}