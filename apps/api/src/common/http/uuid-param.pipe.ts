import { type PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';

const uuidSchema = z.uuid();

/** Identificadores malformados são tratados como recurso inexistente. */
export class UuidParamPipe implements PipeTransform {
  transform(value: unknown): string {
    const result = uuidSchema.safeParse(value);
    if (!result.success) {
      throw new AppError('NOT_FOUND');
    }
    return result.data;
  }
}
