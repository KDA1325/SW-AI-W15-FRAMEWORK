import { BadRequestException, ConflictException } from '@nestjs/common';
import { ArchivePostType } from './entities/archivePost.entity';
import PostsService from './posts.service';

describe('PostsService IGDB game selection', () => {
    function createListQuery(posts: unknown[] = [], total = posts.length) {
        return {
            andWhere: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn().mockResolvedValue([posts, total]),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
        };
    }

    function createService() {
        const tagQuery = {
            getMany: jest.fn().mockResolvedValue([]),
            orderBy: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
        };
        const duplicateQuery = {
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(null),
            innerJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
        };
        const postRepository = {
            create: jest.fn((value: Record<string, unknown>) => value),
            createQueryBuilder: jest.fn().mockReturnValue(duplicateQuery),
            findOne: jest.fn().mockResolvedValue({
                canEdit: true,
                game: { id: 'game-1', igdbId: '114795', title: 'Hades' },
                id: 'post-1',
                userId: 'user-1',
            }),
            save: jest.fn((value: Record<string, unknown>) =>
                Promise.resolve({ ...value, id: 'post-1' }),
            ),
        };
        const commentRepository = {};
        const tagRepository = {
            create: jest.fn((value: Record<string, unknown>) => ({
                ...value,
                id: 'tag-created',
            })),
            createQueryBuilder: jest.fn().mockReturnValue(tagQuery),
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn((value: Record<string, unknown>) =>
                Promise.resolve({ ...value, id: 'tag-1' }),
            ),
        };
        const gameRepository = {
            create: jest.fn((value: Record<string, unknown>) => ({
                ...value,
                id: 'game-1',
            })),
            findOne: jest
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null),
            save: jest.fn((value: Record<string, unknown>) =>
                Promise.resolve(value),
            ),
        };
        const igdbService = {
            searchGames: jest.fn().mockResolvedValue({
                error: null,
                errorCode: null,
                games: [],
                provider: 'igdb',
            }),
        };
        const service = new PostsService(
            postRepository as never,
            commentRepository as never,
            tagRepository as never,
            gameRepository as never,
            igdbService as never,
        );

        return {
            gameRepository,
            igdbService,
            postRepository,
            tagQuery,
            tagRepository,
            duplicateQuery,
            service,
        };
    }

    it('stores the selected IGDB id when creating a post game', async () => {
        const { gameRepository, postRepository, service } = createService();

        await service.create('user-1', {
            content: 'Great run structure.',
            gameTitle: 'Hades',
            igdbGameId: '114795',
            rating: 5,
            title: 'Combat stays readable',
            type: ArchivePostType.REVIEW,
        });

        expect(gameRepository.findOne).toHaveBeenNthCalledWith(1, {
            where: { igdbId: '114795' },
        });
        expect(gameRepository.create).toHaveBeenCalledWith({
            igdbId: '114795',
            title: 'Hades',
        });
        expect(postRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                gameId: 'game-1',
                userId: 'user-1',
            }),
        );
    });

    it('rejects a non-numeric IGDB game id', async () => {
        const { service } = createService();

        await expect(
            service.create('user-1', {
                content: 'Invalid external id should not persist.',
                gameTitle: 'Hades',
                igdbGameId: 'not-a-number',
                rating: 5,
                title: 'Bad id',
                type: ArchivePostType.REVIEW,
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks duplicate reviews for the same user and game', async () => {
        const { duplicateQuery, postRepository, service } = createService();

        duplicateQuery.getOne.mockResolvedValueOnce({
            game: { id: 'game-1', igdbId: '114795', title: 'Hades' },
            gameId: 'game-1',
            id: 'existing-post',
        });

        await expect(
            service.create('user-1', {
                content: 'Second review should be rejected.',
                gameTitle: 'Hades',
                igdbGameId: '114795',
                rating: 4,
                title: 'Duplicate review',
                type: ArchivePostType.REVIEW,
            }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(postRepository.save).not.toHaveBeenCalled();
    });

    it('reports duplicate review status for inline form blocking', async () => {
        const { duplicateQuery, service } = createService();

        duplicateQuery.getOne.mockResolvedValueOnce({
            game: { id: 'game-1', igdbId: '114795', title: 'Hades' },
            gameId: 'game-1',
            id: 'existing-post',
        });

        await expect(
            service.checkReviewDuplicate('user-1', '  Hades  ', '114795'),
        ).resolves.toMatchObject({
            duplicate: true,
            matchedBy: 'igdb',
            message: '이미 리뷰가 존재합니다.',
            postId: 'existing-post',
        });
    });

    it('debounces server-side IGDB calls by ignoring too-short queries', async () => {
        const { igdbService, service } = createService();

        await expect(service.searchGames('h')).resolves.toMatchObject({
            games: [],
            provider: 'igdb',
        });
        expect(igdbService.searchGames).not.toHaveBeenCalled();

        await service.searchGames(' hades ');

        expect(igdbService.searchGames).toHaveBeenCalledWith({
            limit: 8,
            query: 'hades',
        });
    });

    it('returns paginated list metadata with canEdit on each item', async () => {
        const { postRepository, service } = createService();
        const listQuery = createListQuery(
            [
                {
                    game: {
                        id: 'game-2',
                        tags: ['Tactical'],
                        title: 'Into the Breach',
                    },
                    id: 'post-2',
                    title: 'A clean tactics loop',
                    type: ArchivePostType.JOURNAL,
                    userId: 'other-user',
                },
            ],
            12,
        );

        postRepository.createQueryBuilder.mockReturnValueOnce(listQuery);

        await expect(
            service.findAll(
                'user-1',
                ArchivePostType.JOURNAL,
                true,
                'tactical',
                'oldest',
                '5',
                '2',
            ),
        ).resolves.toMatchObject({
            hasNextPage: true,
            hasPreviousPage: true,
            items: [
                {
                    canEdit: false,
                    id: 'post-2',
                },
            ],
            limit: 5,
            page: 2,
            sort: 'oldest',
            total: 12,
            totalPages: 3,
        });
        expect(listQuery.orderBy).toHaveBeenCalledWith(
            'post.createdAt',
            'ASC',
        );
        expect(listQuery.take).toHaveBeenCalledWith(5);
        expect(listQuery.skip).toHaveBeenCalledWith(5);
        expect(listQuery.andWhere).toHaveBeenCalledWith('post.type = :type', {
            type: ArchivePostType.JOURNAL,
        });
        expect(listQuery.andWhere).toHaveBeenCalledWith(
            'post.userId = :userId',
            {
                userId: 'user-1',
            },
        );
        expect(listQuery.andWhere).toHaveBeenCalledWith(expect.any(Object));
    });

    it('normalizes and stores unique post tags', async () => {
        const { service, tagRepository } = createService();

        await expect(service.createTag('#tactical-rpg')).resolves.toMatchObject({
            id: 'tag-1',
            name: 'TACTICAL_RPG',
            normalizedName: 'TACTICAL_RPG',
        });
        expect(tagRepository.findOne).toHaveBeenCalledWith({
            where: { normalizedName: 'TACTICAL_RPG' },
        });
        expect(tagRepository.create).toHaveBeenCalledWith({
            name: 'TACTICAL_RPG',
            normalizedName: 'TACTICAL_RPG',
        });
    });

    it('reuses an existing normalized tag instead of creating duplicates', async () => {
        const { service, tagRepository } = createService();
        const existingTag = {
            id: 'tag-existing',
            name: 'TACTICAL_RPG',
            normalizedName: 'TACTICAL_RPG',
        };

        tagRepository.findOne.mockResolvedValueOnce(existingTag);

        await expect(service.createTag('tactical rpg')).resolves.toBe(
            existingTag,
        );
        expect(tagRepository.save).not.toHaveBeenCalled();
    });

    it('lists tags by normalized search query', async () => {
        const { service, tagQuery } = createService();

        await service.listTags(' tactical-rpg ');

        expect(tagQuery.orderBy).toHaveBeenCalledWith('tag.name', 'ASC');
        expect(tagQuery.take).toHaveBeenCalledWith(50);
        expect(tagQuery.where).toHaveBeenCalledWith(
            'tag.normalizedName ILIKE :query',
            {
                query: '%TACTICAL_RPG%',
            },
        );
    });

    it('rejects unsupported list query parameters', async () => {
        const { service } = createService();

        await expect(
            service.findAll(
                'user-1',
                'ALL',
                false,
                undefined,
                'latest',
                '10',
                '1',
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
            service.findAll(
                'user-1',
                undefined,
                false,
                undefined,
                'popular',
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
            service.findAll(
                'user-1',
                undefined,
                false,
                undefined,
                'latest',
                '20',
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
            service.findAll(
                'user-1',
                undefined,
                false,
                undefined,
                'latest',
                '10',
                '0',
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
    });
});
