import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiRagEmbeddingProvider } from './recommendation-contract';

export type AiComputeEmbeddingRequest = {
  dimensions: number;
  input: string;
  model: string;
};

export type AiComputeEmbeddingResult = {
  dimensions: number;
  model: string;
  provider: AiRagEmbeddingProvider;
  values: number[];
};

export type AiComputeRagSearchRequest = {
  queryEmbedding: number[];
  topK: number;
  userId: string;
};

export type AiComputeRagSearchRow = {
  content: string;
  metadata: {
    gameTitle?: string | null;
    title?: string;
  };
  similarity: number;
  sourceId: string;
  sourceType: string;
};

export type AiComputeAgentPlanRequest = {
  contextSources: Array<{
    gameTitle: string | null;
    sourceId: string;
    sourceType: string;
    title: string;
  }>;
  maxIterations: number;
  preferenceTags: Array<{
    label: string;
    sourceCount: number;
    weight: number;
  }>;
  requestId: string;
  timeoutMs: number;
  userId: string;
};

export type AiComputeAgentPlanResult = {
  errors: string[];
  iterations: number;
  maxIterations: number;
  provider: 'langgraph';
  searchQueries: string[];
  stoppedReason: 'completed' | 'max_iterations' | 'timeout';
  toolPlan: Array<{
    arguments: Record<string, unknown>;
    name: 'search_games';
  }>;
};

export type AiComputeRecommendationBuildRequest = {
  contextSources: Array<{
    excerpt: string;
    gameTitle: string | null;
    similarity: number;
    sourceId: string;
    sourceType: string;
    title: string;
  }>;
  exclusionSet: {
    externalIds: string[];
    gameIds: string[];
    titles: string[];
  };
  localGames: Array<{
    genres: string[];
    id: string;
    imageUrl: string | null;
    platforms: string[];
    signalScore: number;
    steamAppId: string | null;
    tags: string[];
    title: string;
  }>;
  maxRecommendations: number;
  nickname: string;
  preferenceTags: Array<{
    label: string;
    sourceCount: number;
    weight: number;
  }>;
  toolResults: Array<{
    error: string | null;
    errorCode: string | null;
    games: Array<{
      aliases?: string[];
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
      totalRating?: number | null;
    }>;
    provider: 'igdb';
    query: string;
  }>;
  userId: string;
  wordCloud: Array<{
    category: 'genre' | 'mood' | 'mechanic' | 'pace' | 'theme';
    label: string;
    sourceCount: number;
    weight: number;
  }>;
};

export type AiComputeRecommendationBuildResult = {
  provider: 'fastapi-python';
  recommendations: Array<{
    externalId: {
      id: string;
      provider: 'igdb' | 'rawg' | 'steam';
    };
    gameId: string | null;
    genres: string[];
    imageUrl: string | null;
    matchedTags: string[];
    matchScore: number;
    platforms: string[];
    rank: number;
    reason: string;
    sourceUrl: string | null;
    tags: string[];
    title: string;
  }>;
  usedFallback: boolean;
};

type AiComputeEmbedResponse = {
  dimensions?: number;
  embedding?: number[];
  model?: string;
  provider?: AiRagEmbeddingProvider;
};

type AiComputeRagSearchResponse = {
  provider?: 'langchain-pgvector';
  rows?: AiComputeRagSearchRow[];
};

type AiComputeAgentPlanResponse = Partial<AiComputeAgentPlanResult>;

@Injectable()
export class AiComputeClient {
  private readonly logger = new Logger(AiComputeClient.name);

  constructor(private readonly config: ConfigService) {}

  async createEmbedding(
    request: AiComputeEmbeddingRequest,
  ): Promise<AiComputeEmbeddingResult | null> {
    const baseUrl = this.baseUrl();

    if (!baseUrl) {
      return null;
    }

    try {
      const response = await axios.post<AiComputeEmbedResponse>(
        `${baseUrl}/embed`,
        {
          dimensions: request.dimensions,
          input: request.input,
          model: request.model,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.timeoutMs(),
        },
      );
      const values = response.data.embedding;

      if (!values?.length) {
        throw new Error('FastAPI embed response did not include a vector.');
      }

      return {
        dimensions: response.data.dimensions ?? values.length,
        model: response.data.model ?? request.model,
        provider: response.data.provider ?? 'demo',
        values,
      };
    } catch (error) {
      this.logger.warn(
        `FastAPI embedding failed; falling back inside NestJS. ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  async searchRagContext(
    request: AiComputeRagSearchRequest,
  ): Promise<AiComputeRagSearchRow[] | null> {
    const baseUrl = this.baseUrl();

    if (!baseUrl) {
      return null;
    }

    try {
      const response = await axios.post<AiComputeRagSearchResponse>(
        `${baseUrl}/rag/search`,
        {
          queryEmbedding: request.queryEmbedding,
          topK: request.topK,
          userId: request.userId,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.timeoutMs(),
        },
      );

      if (!Array.isArray(response.data.rows)) {
        throw new Error('FastAPI RAG search response did not include rows.');
      }

      return response.data.rows;
    } catch (error) {
      this.logger.warn(
        `FastAPI RAG search failed; falling back inside NestJS. ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  async planAgentSearches(
    request: AiComputeAgentPlanRequest,
  ): Promise<AiComputeAgentPlanResult | null> {
    const baseUrl = this.agentBaseUrl();

    if (!baseUrl) {
      return null;
    }

    try {
      const response = await axios.post<AiComputeAgentPlanResponse>(
        `${baseUrl}/agent/recommendations/plan`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.agentTimeoutMs(),
        },
      );

      if (
        response.data.provider !== 'langgraph' ||
        !Array.isArray(response.data.searchQueries)
      ) {
        throw new Error('FastAPI Agent plan response did not include queries.');
      }

      return response.data as AiComputeAgentPlanResult;
    } catch (error) {
      this.logger.warn(
        `FastAPI Agent plan failed; falling back inside NestJS. ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  async buildRecommendations(
    request: AiComputeRecommendationBuildRequest,
  ): Promise<AiComputeRecommendationBuildResult | null> {
    const baseUrl = this.agentBaseUrl();

    if (!baseUrl) {
      return null;
    }

    try {
      const response = await axios.post<AiComputeRecommendationBuildResult>(
        `${baseUrl}/agent/recommendations/build`,
        request,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.agentTimeoutMs(),
        },
      );

      if (
        response.data.provider !== 'fastapi-python' ||
        !Array.isArray(response.data.recommendations)
      ) {
        throw new Error('FastAPI recommendation build response was invalid.');
      }

      return response.data;
    } catch (error) {
      this.logger.warn(
        `FastAPI recommendation build failed; falling back inside NestJS. ${this.errorMessage(error)}`,
      );
      return null;
    }
  }

  private baseUrl(): string | null {
    const configured = this.config.get<string>('FASTAPI_AI_COMPUTE_URL');

    return configured ? configured.replace(/\/+$/, '') : null;
  }

  private agentBaseUrl(): string | null {
    const configured =
      this.config.get<string>('FASTAPI_AGENT_URL') ??
      this.config.get<string>('FASTAPI_AI_COMPUTE_URL');

    return configured ? configured.replace(/\/+$/, '') : null;
  }

  private timeoutMs(): number {
    return Number(
      this.config.get<string>('FASTAPI_AI_COMPUTE_TIMEOUT_MS') ?? 5000,
    );
  }

  private agentTimeoutMs(): number {
    return Number(
      this.config.get<string>('FASTAPI_AGENT_TIMEOUT_MS') ??
        this.config.get<string>('FASTAPI_AI_COMPUTE_TIMEOUT_MS') ??
        5000,
    );
  }

  private errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;

      return status ? `HTTP ${status}: ${message}` : message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
