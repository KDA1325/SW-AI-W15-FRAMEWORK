import { BadRequestException } from '@nestjs/common';
import { ArchivePostType } from './entities/archivePost.entity';
import PostsService from './posts.service';

describe('PostsService IGDB game selection', () => {
    function createService() {
        const postRepository = {
            create: jest.fn((value) => value),
            findOne: jest.fn().mockResolvedValue({
                canEdit: true,
                game: { id: 'game-1', igdbId: '114795', title: 'Hades' },
                id: 'post-1',
                userId: 'user-1',
            }),
            save: jest.fn((value) =>
                Promise.resolve({ ...value, id: 'post-1' }),
            ),
        };
        const commentRepository = {};
        const gameRepository = {
            create: jest.fn((value) => ({ ...value, id: 'game-1' })),
            findOne: jest
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(null),
            save: jest.fn((value) => Promise.resolve(value)),
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
            gameRepository as never,
            igdbService as never,
        );

        return {
            gameRepository,
            igdbService,
            postRepository,
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
});
