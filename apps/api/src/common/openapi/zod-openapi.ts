import { paginationMetaSchema } from '@efed/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { z } from 'zod';

type OpenApiSchema = Record<string, unknown>;

function toOpenApi(schema: z.ZodType, io: 'input' | 'output'): OpenApiSchema {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  }) as OpenApiSchema;
  return rest;
}

/** Documenta o corpo da requisição a partir do schema Zod que o valida. */
export function ApiZodBody(schema: z.ZodType): MethodDecorator {
  return ApiBody({ schema: toOpenApi(schema, 'input') });
}

/** Documenta os parâmetros de consulta a partir de um objeto Zod. */
export function ApiZodQuery(schema: z.ZodObject): MethodDecorator {
  const json = toOpenApi(schema, 'input') as {
    properties?: Record<string, OpenApiSchema>;
    required?: string[];
  };
  const required = new Set(json.required ?? []);
  const decorators = Object.entries(json.properties ?? {}).map(([name, property]) =>
    ApiQuery({ name, required: required.has(name), schema: property }),
  );
  return applyDecorators(...decorators);
}

interface ZodResponseOptions {
  status?: number;
  description: string;
  paginated?: boolean;
  isArray?: boolean;
}

/** Documenta a resposta de sucesso no envelope `{ data }` (ou `{ data, meta }` quando paginada). */
export function ApiZodResponse(schema: z.ZodType, options: ZodResponseOptions): MethodDecorator {
  const item = toOpenApi(schema, 'output');
  const data = options.paginated || options.isArray ? { type: 'array', items: item } : item;
  const properties: Record<string, OpenApiSchema> = { data };
  const required = ['data'];
  if (options.paginated) {
    properties.meta = toOpenApi(paginationMetaSchema, 'output');
    required.push('meta');
  }
  return ApiResponse({
    status: options.status ?? 200,
    description: options.description,
    schema: { type: 'object', properties, required },
  });
}

const problemSchema: OpenApiSchema = {
  type: 'object',
  required: ['status', 'code', 'title'],
  properties: {
    status: { type: 'integer' },
    code: { type: 'string', description: 'Código estável do erro.' },
    title: { type: 'string' },
    detail: { type: 'string' },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['path', 'message'],
        properties: { path: { type: 'string' }, message: { type: 'string' } },
      },
    },
    requestId: { type: 'string' },
  },
};

/** Documenta respostas de erro no formato `application/problem+json`. */
export function ApiProblems(...statuses: number[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: 'Erro no formato problem details.',
        content: { 'application/problem+json': { schema: problemSchema } },
      }),
    ),
  );
}
