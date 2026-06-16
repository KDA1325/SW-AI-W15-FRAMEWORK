import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  AiAgentStoppedReason,
  AiRecommendationCard,
  AiRecommendationSyncResponse,
  AiRagAnalysisResponse,
} from './recommendation-contract';
import { AiProfile } from '../auth/entities/aiProfile.entity';
import { McpService } from './mcp.service';
import { RagService } from './rag.service';

const DEFAULT_AGENT_MAX_ITERATIONS = 4;
const DEFAULT_AGENT_TIMEOUT_MS = 30_000;
const MIN_RECOMMENDATION_COUNT = 3;

type AgentSyncOptions = {
  forceRefresh?: boolean;
  requestId?: string;
  topK?: number;
};

type AgentToolResult = {
  error: string | null;
  errorCode: string | null;
  games: Array<{
    externalId: {
      id: string;
      provider: 'igdb';
    };
    genres: string[];
    imageUrl: string | null;
    platforms: string[];
    releaseDate: string | null;
    sourceUrl: string | null;
    summary: string | null;
    tags: string[];
    title: string;
  }>;
  provider: 'igdb';
  query: string;
};

type McpToolCallSuccess = {
  result?: {
    structuredContent?: Omit<AgentToolResult, 'query'>;
  };
};

type AgentState = {
  maxIterations: number;
  recommendations: AiRecommendationCard[];
  startedAt: number;
  toolResults: AgentToolResult[];
  userId: string;
};

type LocalGameRow = {
  genres: string[];
  id: string;
  imageUrl: string | null;
  platforms: string[];
  signalScore: number | string;
  steamAppId: string | null;
  tags: string[];
  title: string;
};

@Injectable()
export class AgentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mcpService: McpService,
    private readonly ragService: RagService,
  ) {}

  async syncRecommendations(
    userId: string,
    options: AgentSyncOptions = {},
  ): Promise<AiRecommendationSyncResponse> {
    const requestId = options.requestId ?? `gjc-sync-${Date.now()}`;
    const ragContext = await this.ragService.analyzeForUser(userId, {
      refreshEmbeddings: options.forceRefresh !== false,
      topK: options.topK,
    });
    const state: AgentState = {
      maxIterations: this.maxIterations(),
      recommendations: [],
      startedAt: Date.now(),
      toolResults: [],
      userId,
    };
    let usedFallback = false;

    for (const query of this.buildSearchQueries(ragContext)) {
      if (this.shouldStop(state)) {
        break;
      }

      const toolResult = await this.callSearchGamesTool(query, ragContext);
      state.toolResults.push(toolResult);
      state.recommendations.push(
        ...this.toRecommendations(toolResult, ragContext, state),
      );
      state.recommendations = this.uniqueRecommendations(state.recommendations);

      if (state.recommendations.length >= MIN_RECOMMENDATION_COUNT) {
        break;
      }
    }

    if (state.recommendations.length < MIN_RECOMMENDATION_COUNT) {
      usedFallback = true;
      state.recommendations = this.uniqueRecommendations([
        ...state.recommendations,
        ...(await this.fallbackRecommendations(ragContext, state)),
      ]);
    }

    const stoppedReason: AiAgentStoppedReason = usedFallback
      ? 'fallback'
      : state.recommendations.length >= MIN_RECOMMENDATION_COUNT
        ? 'completed'
        : this.timedOut(state)
          ? 'timeout'
          : state.toolResults.length >= state.maxIterations
            ? 'max_iterations'
            : 'fallback';

    const now = new Date().toISOString();

    const response: AiRecommendationSyncResponse = {
      requestId,
      userId,
      generatedAt: now,
      lastSyncAt: now,
      preferenceTags: ragContext.preferenceTags,
      playStyleSummary: ragContext.playStyleSummary,
      wordCloud: ragContext.wordCloud,
      recommendations: state.recommendations
        .slice(0, MIN_RECOMMENDATION_COUNT)
        .map((recommendation, index) => ({
          ...recommendation,
          rank: index + 1,
        })),
      contextSources: ragContext.contextSources,
      pipeline: {
        agent: {
          iterations: state.toolResults.length,
          maxIterations: state.maxIterations,
          stoppedReason,
        },
        mcp: {
          provider: 'igdb',
          resultCount: state.toolResults.reduce(
            (sum, result) => sum + result.games.length,
            0,
          ),
          toolName: 'search_games',
        },
        rag: {
          sourceCount: ragContext.contextSources.length,
          topK: options.topK ?? ragContext.contextSources.length,
        },
      },
    };

    await this.saveLatestRecommendationSync(userId, response);

    return response;
  }

  async getLatestRecommendations(
    userId: string,
  ): Promise<AiRecommendationSyncResponse | null> {
    const profile = await this.dataSource.getRepository(AiProfile).findOne({
      where: { userId },
    });

    return profile?.lastRecommendationSync ?? null;
  }

  private buildSearchQueries(ragContext: AiRagAnalysisResponse): string[] {
    const tagQueries = ragContext.preferenceTags
      .slice(0, 3)
      .map((tag) => tag.label.replaceAll('_', ' '));
    const sourceQueries = ragContext.contextSources
      .map((source) => source.gameTitle)
      .filter((title): title is string => Boolean(title));

    // The loop treats each query as a function-calling decision: inspect state, call search_games, merge results.
    return [...new Set([...sourceQueries, ...tagQueries, 'story rich RPG'])];
  }

  private async callSearchGamesTool(
    query: string,
    ragContext: AiRagAnalysisResponse,
  ): Promise<AgentToolResult> {
    const response = await this.mcpService.handle({
      id: query,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: {
          limit: 5,
          preferenceTags: ragContext.preferenceTags.map((tag) => tag.label),
          query,
        },
        name: 'search_games',
      },
    });

    const structuredContent = this.isMcpToolCallSuccess(response)
      ? response.result?.structuredContent
      : undefined;

    return {
      error: structuredContent?.error ?? 'MCP search_games returned no result.',
      errorCode: structuredContent?.errorCode ?? 'external_api_error',
      games: structuredContent?.games ?? [],
      provider: 'igdb',
      query,
    };
  }

  private toRecommendations(
    toolResult: AgentToolResult,
    ragContext: AiRagAnalysisResponse,
    state: AgentState,
  ): AiRecommendationCard[] {
    const matchedTags = ragContext.preferenceTags
      .slice(0, 4)
      .map((tag) => tag.label);

    return toolResult.games.map((game, index) => ({
      externalId: game.externalId,
      gameId: null,
      genres: game.genres,
      imageUrl: game.imageUrl,
      matchedTags,
      matchScore: Number(
        Math.max(
          0.72,
          0.94 - (state.recommendations.length + index) * 0.04,
        ).toFixed(2),
      ),
      platforms: game.platforms,
      rank: state.recommendations.length + index + 1,
      reason: this.recommendationReason(
        game.title,
        matchedTags,
        toolResult.query,
      ),
      sourceUrl: game.sourceUrl,
      tags: game.tags,
      title: game.title,
    }));
  }

  private isMcpToolCallSuccess(
    response: unknown,
  ): response is McpToolCallSuccess {
    return (
      response !== null && typeof response === 'object' && 'result' in response
    );
  }

  private async fallbackRecommendations(
    ragContext: AiRagAnalysisResponse,
    state: AgentState,
  ): Promise<AiRecommendationCard[]> {
    const localGames = await this.loadUserScopedLocalGames(state.userId);
    const matchedTags = ragContext.preferenceTags
      .slice(0, 4)
      .map((tag) => tag.label);

    return localGames.map((game, index) => {
      const signalScore = Number(game.signalScore);

      return {
        externalId: {
          id: game.steamAppId ?? game.id,
          provider: game.steamAppId ? 'steam' : 'igdb',
        },
        gameId: game.id,
        genres: game.genres,
        imageUrl: game.imageUrl,
        matchedTags,
        matchScore: Number(
          Math.min(
            0.92,
            Math.max(0.68, 0.7 + signalScore * 0.04 - index * 0.02),
          ).toFixed(2),
        ),
        platforms: game.platforms,
        rank: state.recommendations.length + index + 1,
        reason:
          `Fallback recommendation from this user's own journal, review, and Steam play signals. ` +
          this.recommendationReason(game.title, matchedTags, game.title),
        sourceUrl: game.steamAppId
          ? `https://store.steampowered.com/app/${game.steamAppId}`
          : null,
        tags: game.tags,
        title: game.title,
      };
    });
  }

  private async loadUserScopedLocalGames(
    userId: string,
  ): Promise<LocalGameRow[]> {
    return this.dataSource.query<LocalGameRow[]>(
      `
        WITH user_signal_terms AS (
          SELECT array_agg(DISTINCT lower(signal.term)) AS terms
          FROM (
            SELECT unnest(game.tags || game.genres || game.platforms) AS term
            FROM "ArchivePost" post
            INNER JOIN "Game" game ON game.id = post."gameId"
            WHERE post."userId" = $1

            UNION

            SELECT unnest(game.tags || game.genres || game.platforms) AS term
            FROM "UserGame" user_game
            INNER JOIN "Game" game ON game.id = user_game."gameId"
            WHERE user_game."userId" = $1
          ) signal
        )
        SELECT
          game.id,
          game.title,
          game."imageUrl",
          game.genres,
          game.platforms,
          game.tags,
          game."steamAppId",
          COALESCE((
            SELECT count(*)
            FROM unnest(game.tags || game.genres || game.platforms) AS candidate(term)
            WHERE lower(candidate.term) = ANY(COALESCE(signals.terms, ARRAY[]::text[]))
          ), 0)::int AS "signalScore"
        FROM "Game" game
        CROSS JOIN user_signal_terms signals
        WHERE COALESCE(array_length(signals.terms, 1), 0) > 0
          AND EXISTS (
            SELECT 1
            FROM unnest(game.tags || game.genres || game.platforms) AS candidate(term)
            WHERE lower(candidate.term) = ANY(signals.terms)
          )
        ORDER BY "signalScore" DESC, game."updatedAt" DESC
        LIMIT 10
      `,
      [userId],
    );
  }

  private async saveLatestRecommendationSync(
    userId: string,
    response: AiRecommendationSyncResponse,
  ): Promise<void> {
    const repository = this.dataSource.getRepository(AiProfile);
    let profile = await repository.findOne({ where: { userId } });

    if (!profile) {
      profile = repository.create({ userId });
    }

    // The page reload path reads this exact snapshot, so only an explicit SYNC click changes what React displays.
    profile.lastRecommendationSync = response;
    profile.playStyleSummary = response.playStyleSummary;
    profile.favoriteKeywords = response.preferenceTags.map((tag) => tag.label);
    profile.favoriteGenres = response.wordCloud
      .filter((term) => term.category === 'genre')
      .map((term) => term.label);
    profile.lastAnalyzedAt = new Date(response.generatedAt);

    await repository.save(profile);
  }

  private recommendationReason(
    title: string,
    matchedTags: string[],
    query: string,
  ): string {
    const tags =
      matchedTags.length > 0
        ? matchedTags.join(', ')
        : 'the available RAG context';

    return `${title} matches the search signal "${query}" and the player's RAG tags: ${tags}.`;
  }

  private uniqueRecommendations(
    recommendations: AiRecommendationCard[],
  ): AiRecommendationCard[] {
    const seen = new Set<string>();
    const unique: AiRecommendationCard[] = [];

    for (const recommendation of recommendations) {
      const key = recommendation.title.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      unique.push(recommendation);
    }

    return unique;
  }

  private maxIterations(): number {
    const rawValue = Number(this.config.get<string>('AGENT_MAX_ITERATIONS'));
    return Number.isInteger(rawValue) && rawValue > 0
      ? rawValue
      : DEFAULT_AGENT_MAX_ITERATIONS;
  }

  private timeoutMs(): number {
    const rawValue = Number(this.config.get<string>('AGENT_TIMEOUT_MS'));
    return Number.isInteger(rawValue) && rawValue > 0
      ? rawValue
      : DEFAULT_AGENT_TIMEOUT_MS;
  }

  private shouldStop(state: AgentState): boolean {
    return (
      state.toolResults.length >= state.maxIterations || this.timedOut(state)
    );
  }

  private timedOut(state: AgentState): boolean {
    return Date.now() - state.startedAt > this.timeoutMs();
  }
}
