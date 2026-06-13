// Controller, Get, Post 같은 데코레이터는 API 주소를 만들 때 사용합니다.
// Body는 요청 body를 꺼낼 때, Req/Res는 요청/응답 객체를 직접 다룰 때 사용합니다.
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import CreatePostDto from './dto/create-post.dto';
import UpdatePostDto from './dto/update-post.dto';
import {
    ArchivePost,
    ArchivePostType,
} from './entities/archivePost.entity';
import { Game } from '../auth/entities/game.entity';

// 요청 DTO를 DB 엔티티로 바꾸고 권한 규칙을 보장하기 
// PostsService는 컨트롤러에서 받은 DTO를 DB 엔티티로 바꾸고,
// 게시글 생성/조회/수정/삭제에 필요한 비즈니스 규칙을 보장합니다.
@Injectable()
export default class PostsService {
    constructor(
        @InjectRepository(ArchivePost)
        private postRepository: Repository<ArchivePost>,

        @InjectRepository(Game)
        private gameRepository: Repository<Game>,
    ) { }

    // 새 저널/리뷰를 저장합니다.
    // 작성자는 요청 body가 아니라 JWT에서 꺼낸 userId로 고정해서 위조를 막습니다.
    async create(userId: string, dto: CreatePostDto) {
        // REVIEW/JOURNAL 타입별 rating 규칙은 DB 저장 전에 먼저 검사합니다.
        this.validatePostPayload(dto.type, dto.rating);

        // 클라이언트는 gameTitle만 보내므로, 서버에서 Game 레코드를 찾아 연결합니다.
        const game = await this.findOrCreateGame(dto.gameTitle);

        const post = this.postRepository.create({
            userId,
            gameId: game.id,
            type: dto.type,
            title: dto.title,
            content: dto.content,
            rating: dto.type === ArchivePostType.REVIEW ? dto.rating! : null,
        });

        const savedPost = await this.postRepository.save(post);

        // 저장 직후 relation(game, user)과 canEdit까지 포함한 상세 응답을 재사용합니다.
        return this.findOne(userId, savedPost.id);
    }

    // 게시글 목록을 최신순으로 조회합니다.
    // type이 들어오면 REVIEW 또는 JOURNAL만 필터링하고, 없으면 전체를 반환합니다.
    async findAll(userId: string, type?: ArchivePostType) {
        return this.postRepository.find({
            where: {
                ...(type ? { type } : {}),
            },
            relations: {
                game: true,
                user: true,
            },
            order: {
                createdAt: 'DESC',
            },
        });
    }

    // 게시글 상세를 조회합니다.
    // canEdit은 프론트에서 수정/삭제 버튼 노출 여부를 판단할 수 있도록 내려주는 값입니다.
    async findOne(userId: string, id: string) {
        const post = await this.postRepository.findOne({
            where: { id },
            relations: {
                game: true,
                user: true,
            },
        });

        if (!post) {
            throw new NotFoundException('게시글을 찾을 수 없습니다.');
        }

        return {
            ...post,
            canEdit: post.userId === userId,
        };
    }

    // 게시글을 수정합니다.
    // 수정 전에 반드시 소유자 검사를 해서 본인 글만 변경할 수 있게 합니다.
    async update(userId: string, id: string, dto: UpdatePostDto) {
        const post = await this.findPostOrThrow(id);
        this.assertOwner(post, userId);

        // 게임 제목이 바뀌면 새 제목에 해당하는 Game을 찾아 다시 연결합니다.
        if (dto.gameTitle) {
            const game = await this.findOrCreateGame(dto.gameTitle);
            post.gameId = game.id;
        }

        if (dto.title !== undefined) {
            post.title = dto.title;
        }

        if (dto.content !== undefined) {
            post.content = dto.content;
        }

        if (dto.rating !== undefined) {
            if (post.type !== ArchivePostType.REVIEW) {
                throw new BadRequestException('저널에는 평점을 저장할 수 없습니다.');
            }

            post.rating = dto.rating;
        }

        await this.postRepository.save(post);

        return this.findOne(userId, id);
    }

    // 게시글을 삭제합니다.
    // 삭제도 수정과 마찬가지로 작성자 본인에게만 허용합니다.
    async remove(userId: string, id: string) {
        const post = await this.findPostOrThrow(id);
        this.assertOwner(post, userId);

        await this.postRepository.remove(post);

        return { ok: true };
    }

    // gameTitle을 기준으로 Game을 찾고, 아직 없으면 새로 만듭니다.
    // 게시글은 gameId를 필요로 하므로 생성 API에서 공통으로 사용하는 helper입니다.
    private async findOrCreateGame(gameTitle: string) {
        const title = gameTitle.trim();

        let game = await this.gameRepository.findOne({
            where: { title },
        });

        if (!game) {
            game = this.gameRepository.create({
                title,
            });

            game = await this.gameRepository.save(game);
        }

        return game;
    }

    // id로 게시글을 찾고, 없으면 404 예외를 던집니다.
    // update/remove처럼 존재 확인이 먼저 필요한 흐름에서 중복을 줄이기 위한 helper입니다.
    private async findPostOrThrow(id: string) {
        const post = await this.postRepository.findOne({
            where: { id },
        });

        if (!post) {
            throw new NotFoundException('게시글을 찾을 수 없습니다.');
        }

        return post;
    }

    // 로그인한 사용자와 게시글 작성자가 같은지 검사합니다.
    // 다르면 403으로 막아 "본인 글만 수정/삭제" 완료 기준을 만족시킵니다.
    private assertOwner(post: ArchivePost, userId: string) {
        if (post.userId !== userId) {
            throw new ForbiddenException('본인 글만 수정하거나 삭제할 수 있습니다.');
        }
    }

    // REVIEW는 rating이 필수이고, JOURNAL은 rating을 받지 않는다는 도메인 규칙입니다.
    // DTO는 기본 타입/범위를 검증하고, 타입 간 조건부 규칙은 서비스에서 검사합니다.
    private validatePostPayload(type: ArchivePostType, rating?: number) {
        if (type === ArchivePostType.REVIEW && rating === undefined) {
            throw new BadRequestException('리뷰에는 평점이 필요합니다.');
        }

        if (type === ArchivePostType.JOURNAL && rating !== undefined) {
            throw new BadRequestException('저널에는 평점을 저장할 수 없습니다.');
        }
    }

}
