import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

interface ResponseEnvelope {
  data: unknown;
  meta: Record<string, unknown>;
  errors: null;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((payload) => this.wrap(payload)));
  }

  private wrap(payload: unknown): unknown {
    if (payload instanceof StreamableFile || Buffer.isBuffer(payload)) {
      return payload;
    }

    if (this.isEnvelopeLike(payload)) {
      const envelope = payload as Record<string, unknown>;
      return this.createEnvelope(envelope.data ?? null, envelope.meta);
    }

    return this.createEnvelope(payload ?? null);
  }

  private createEnvelope(data: unknown, meta?: unknown): ResponseEnvelope {
    const currentMeta = this.isRecord(meta) ? { ...meta } : {};
    if (typeof currentMeta.timestamp !== 'string') {
      currentMeta.timestamp = new Date().toISOString();
    }

    return {
      data,
      meta: currentMeta,
      errors: null,
    };
  }

  private isEnvelopeLike(value: unknown): boolean {
    if (!this.isRecord(value)) {
      return false;
    }

    const hasDataAndMeta = 'data' in value && 'meta' in value;
    const hasDataAndErrors = 'data' in value && 'errors' in value;
    const hasMetaAndErrors = 'meta' in value && 'errors' in value;

    return hasDataAndMeta || hasDataAndErrors || hasMetaAndErrors;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
