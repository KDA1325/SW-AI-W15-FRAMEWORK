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

type AiComputeEmbedResponse = {
  dimensions?: number;
  embedding?: number[];
  model?: string;
  provider?: AiRagEmbeddingProvider;
};

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

  private baseUrl(): string | null {
    const configured =
      this.config.get<string>('FASTAPI_AI_COMPUTE_URL') ??
      this.config.get<string>('FASTAPI_AGENT_URL');

    return configured ? configured.replace(/\/+$/, '') : null;
  }

  private timeoutMs(): number {
    return Number(
      this.config.get<string>('FASTAPI_AI_COMPUTE_TIMEOUT_MS') ??
        this.config.get<string>('FASTAPI_AGENT_TIMEOUT_MS') ??
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
