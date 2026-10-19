import type { FieldError } from '@efed/shared';
import { type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

/**
 * Valida e normaliza a entrada com o mesmo schema Zod usado pelos formulários do frontend.
 * Uso: `@Body(new ZodValidationPipe(loginSchema)) body: LoginInput`.
 */
export class ZodValidationPipe<Schema extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.output<Schema> {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }
    const errors: FieldError[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError('VALIDATION_FAILED', { errors });
  }
}
