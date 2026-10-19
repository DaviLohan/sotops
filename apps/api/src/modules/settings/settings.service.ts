import {
  DEFAULT_FEDERATION_NAME,
  type FederationSettings,
  federationSettingsSchema,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '../../common/http/request-context.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth.types.js';

/** Chave de cada campo em `system_settings`. Ausente no banco = valor padrão. */
const KEYS: Record<keyof FederationSettings, string> = {
  federationName: 'federation.name',
};

const DEFAULTS: FederationSettings = { federationName: DEFAULT_FEDERATION_NAME };

/** Configurações gerais da federação (decisão D10: nome provisório, editável). */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<FederationSettings> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: Object.values(KEYS) } },
    });
    const stored = Object.fromEntries(
      (Object.keys(KEYS) as (keyof FederationSettings)[]).flatMap((field) => {
        const row = rows.find((candidate) => candidate.key === KEYS[field]);
        return row ? [[field, row.value]] : [];
      }),
    );
    // Valor inválido no banco (edição manual) não derruba o portal: volta ao padrão.
    const parsed = federationSettingsSchema.safeParse({ ...DEFAULTS, ...stored });
    return parsed.success ? parsed.data : DEFAULTS;
  }

  async update(
    actor: AuthContext,
    input: FederationSettings,
    context: RequestContext,
  ): Promise<FederationSettings> {
    const current = await this.get();
    const changed = (Object.keys(KEYS) as (keyof FederationSettings)[]).filter(
      (field) => current[field] !== input[field],
    );
    if (changed.length === 0) {
      return current;
    }
    await this.prisma.$transaction(async (tx) => {
      for (const field of changed) {
        await tx.systemSetting.upsert({
          where: { key: KEYS[field] },
          create: { key: KEYS[field], value: input[field], updatedById: actor.user.id },
          update: { value: input[field], updatedById: actor.user.id },
        });
      }
      await this.audit.record(
        {
          action: 'settings.updated',
          actorUserId: actor.user.id,
          entityType: 'settings',
          metadata: Object.fromEntries(
            changed.map((field) => [field, { from: current[field], to: input[field] }]),
          ),
          context,
        },
        tx,
      );
    });
    return this.get();
  }
}
