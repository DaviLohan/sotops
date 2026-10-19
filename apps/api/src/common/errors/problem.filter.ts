import type { ApiProblem, ErrorCode } from '@efed/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AppError, titleForCode } from './app-error.js';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'VALIDATION_FAILED',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/**
 * Converte qualquer exceção em uma resposta `application/problem+json` consistente.
 * Erros inesperados são registrados com a pilha, mas nunca expostos ao cliente.
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    const problem = this.toProblem(exception, request);
    problem.requestId = requestId;

    if (exception instanceof AppError && exception.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }
    if (exception instanceof ThrottlerException) {
      this.normalizeRetryAfter(response);
    }

    response.status(problem.status).type('application/problem+json').send(JSON.stringify(problem));
  }

  /**
   * Limitadores nomeados publicam `Retry-After-<nome>`; os clientes só entendem o cabeçalho
   * padrão. Publica o maior tempo de espera entre eles como `Retry-After`.
   */
  private normalizeRetryAfter(response: Response): void {
    const waits = Object.entries(response.getHeaders())
      .filter(([name]) => name.toLowerCase().startsWith('retry-after'))
      .map(([, value]) => Number(value))
      .filter((seconds) => Number.isFinite(seconds) && seconds > 0);
    if (waits.length > 0) {
      response.setHeader('Retry-After', String(Math.max(...waits)));
    }
  }

  /**
   * Status 4xx de exceções do NestJS ou de middlewares do Express (ex.: JSON malformado ou
   * corpo acima do limite, que chegam como erros com `statusCode`).
   */
  private clientErrorStatus(exception: unknown): number | undefined {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : typeof exception === 'object' && exception !== null && 'statusCode' in exception
          ? Number(exception.statusCode)
          : undefined;
    return status !== undefined && status >= 400 && status < 500 ? status : undefined;
  }

  private toProblem(exception: unknown, request: Request): ApiProblem {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        code: exception.code,
        title: exception.title,
        detail: exception.detail,
        errors: exception.errors,
      };
    }

    if (exception instanceof ThrottlerException) {
      return { status: 429, code: 'RATE_LIMITED', title: titleForCode('RATE_LIMITED') };
    }

    const status = this.clientErrorStatus(exception);
    if (status !== undefined) {
      const code = STATUS_TO_CODE[status] ?? 'VALIDATION_FAILED';
      return { status, code, title: titleForCode(code) };
    }

    this.logger.error(
      { err: exception, method: request.method, path: request.path },
      'Erro não tratado',
    );
    return { status: 500, code: 'INTERNAL_ERROR', title: titleForCode('INTERNAL_ERROR') };
  }
}
