import { randomUUID } from 'node:crypto';
import type {
  AdminBannerDto,
  AdminNewsDto,
  BannerData,
  CompetitionOption,
  ListNewsQuery,
  NewsInput,
  PaginatedResponse,
} from '@efed/shared';
import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { paginated, toSkipTake } from '../../common/http/pagination.js';
import type { RequestContext } from '../../common/http/request-context.js';
import type { Banner, Prisma } from '../../generated/prisma/client.js';
import { isUniqueViolation, PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import { slugify } from '../clubs/clubs-admin.service.js';

const newsInclude = {
  author: { select: { username: true, displayName: true } },
} satisfies Prisma.NewsInclude;
type NewsRow = Prisma.NewsGetPayload<{ include: typeof newsInclude }>;

function toNewsDto(row: NewsRow, now: Date): AdminNewsDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    isFeatured: row.isFeatured,
    isLive: row.status !== 'DRAFT' && row.publishedAt !== null && row.publishedAt <= now,
    author: row.author,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Regra da HOME (`PublicService.activeBanner`): o ativo mais recente dentro da janela. */
function isWithinWindow(banner: Banner, now: Date): boolean {
  return (
    banner.isActive &&
    (!banner.startsAt || banner.startsAt <= now) &&
    (!banner.endsAt || banner.endsAt > now)
  );
}

function toBannerDto(row: Banner, showingId: string | null): AdminBannerDto {
  return {
    id: row.id,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    isActive: row.isActive,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    isShowing: row.id === showingId,
    createdAt: row.createdAt.toISOString(),
  };
}

const NEWS_FIELDS = ['title', 'summary', 'body', 'category', 'status', 'isFeatured'] as const;

/** Notícias, banners do hero e competição em destaque. */
@Injectable()
export class ContentAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Notícias ---------------------------------------------------------------------------

  async listNews(query: ListNewsQuery): Promise<PaginatedResponse<AdminNewsDto>> {
    const where: Prisma.NewsWhereInput = {
      status: query.status,
      OR: query.search
        ? [
            { title: { contains: query.search, mode: 'insensitive' } },
            { category: { contains: query.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        include: newsInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
      }),
      this.prisma.news.count({ where }),
    ]);
    const now = new Date();
    return paginated(
      rows.map((row) => toNewsDto(row, now)),
      total,
      query,
    );
  }

  async createNews(
    actor: AuthContext,
    input: NewsInput,
    context: RequestContext,
  ): Promise<AdminNewsDto> {
    const base = slugify(input.title).slice(0, 110) || 'noticia';
    // ponytail: o sufixo aleatório evita colisão sem consultar; legível o bastante para uma URL.
    const slug = (await this.prisma.news.findUnique({ where: { slug: base } }))
      ? `${base}-${randomUUID().slice(0, 6)}`
      : base;
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const news = await tx.news.create({
          data: { ...this.newsColumns(input), slug, authorUserId: actor.user.id },
        });
        await this.audit.record(
          {
            action: 'news.created',
            actorUserId: actor.user.id,
            entityType: 'news',
            entityId: news.id,
            metadata: { status: news.status },
            context,
          },
          tx,
        );
        return news.id;
      });
      return this.getNews(id);
    } catch (error) {
      if (isUniqueViolation(error, 'slug')) {
        throw new AppError('CONFLICT', {
          detail: 'Outra notícia com este título acabou de ser criada.',
        });
      }
      throw error;
    }
  }

  /** A URL (slug) não muda com o título: links já compartilhados continuam válidos. */
  async updateNews(
    actor: AuthContext,
    id: string,
    input: NewsInput,
    context: RequestContext,
  ): Promise<AdminNewsDto> {
    const current = await this.prisma.news.findUnique({ where: { id } });
    if (!current) {
      throw new AppError('NOT_FOUND');
    }
    const next = this.newsColumns(input, current.publishedAt);
    const changed: string[] = NEWS_FIELDS.filter((field) => current[field] !== next[field]);
    if ((current.publishedAt?.getTime() ?? null) !== (next.publishedAt?.getTime() ?? null)) {
      changed.push('publishedAt');
    }
    if (changed.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.news.update({ where: { id }, data: next });
        await this.audit.record(
          {
            action: 'news.updated',
            actorUserId: actor.user.id,
            entityType: 'news',
            entityId: id,
            metadata: { fields: changed, status: next.status },
            context,
          },
          tx,
        );
      });
    }
    return this.getNews(id);
  }

  async getNews(id: string): Promise<AdminNewsDto> {
    const row = await this.prisma.news.findUnique({ where: { id }, include: newsInclude });
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    return toNewsDto(row, new Date());
  }

  /** Publicar sem data vale "agora"; uma notícia já publicada mantém a data original. */
  private newsColumns(input: NewsInput, previous: Date | null = null) {
    const publishedAt = input.publishedAt
      ? new Date(input.publishedAt)
      : input.status === 'PUBLISHED'
        ? (previous ?? new Date())
        : null;
    return {
      title: input.title,
      summary: input.summary,
      body: input.body,
      category: input.category,
      status: input.status,
      isFeatured: input.isFeatured,
      publishedAt,
    };
  }

  // --- Banners ----------------------------------------------------------------------------

  async listBanners(): Promise<AdminBannerDto[]> {
    const rows = await this.prisma.banner.findMany({ orderBy: [{ createdAt: 'desc' }] });
    const now = new Date();
    const showing = rows.find((row) => isWithinWindow(row, now));
    return rows.map((row) => toBannerDto(row, showing?.id ?? null));
  }

  async createBanner(
    actor: AuthContext,
    input: BannerData,
    context: RequestContext,
  ): Promise<AdminBannerDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const banner = await tx.banner.create({ data: this.bannerColumns(input) });
      await this.audit.record(
        {
          action: 'banner.created',
          actorUserId: actor.user.id,
          entityType: 'banner',
          entityId: banner.id,
          context,
        },
        tx,
      );
      return banner.id;
    });
    return this.getBanner(id);
  }

  async updateBanner(
    actor: AuthContext,
    id: string,
    input: BannerData,
    context: RequestContext,
  ): Promise<AdminBannerDto> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.banner.updateMany({
        where: { id },
        data: this.bannerColumns(input),
      });
      if (updated.count !== 1) {
        throw new AppError('NOT_FOUND');
      }
      await this.audit.record(
        {
          action: 'banner.updated',
          actorUserId: actor.user.id,
          entityType: 'banner',
          entityId: id,
          metadata: { isActive: input.isActive },
          context,
        },
        tx,
      );
    });
    return this.getBanner(id);
  }

  private async getBanner(id: string): Promise<AdminBannerDto> {
    const banner = (await this.listBanners()).find((row) => row.id === id);
    if (!banner) {
      throw new AppError('NOT_FOUND');
    }
    return banner;
  }

  private bannerColumns(input: BannerData) {
    return {
      eyebrow: input.eyebrow,
      title: input.title,
      subtitle: input.subtitle,
      ctaLabel: input.ctaLabel,
      ctaHref: input.ctaHref,
      isActive: input.isActive,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    };
  }

  // --- Competição em destaque -------------------------------------------------------------

  async competitionOptions(): Promise<CompetitionOption[]> {
    const rows = await this.prisma.competition.findMany({
      where: { status: { not: 'DRAFT' } },
      include: { season: { select: { name: true } } },
      orderBy: [{ season: { startsOn: 'desc' } }, { name: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      seasonName: row.season.name,
      status: row.status,
      isFeatured: row.isFeatured,
    }));
  }

  /** No máximo uma em destaque (índice único parcial): desmarca a atual e marca a nova. */
  async setFeatured(
    actor: AuthContext,
    competitionId: string | null,
    context: RequestContext,
  ): Promise<CompetitionOption[]> {
    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.competition.findFirst({
        where: { isFeatured: true },
        select: { id: true },
      });
      if (previous?.id === competitionId) {
        return;
      }
      if (competitionId) {
        const target = await tx.competition.findUnique({ where: { id: competitionId } });
        if (!target || target.status === 'DRAFT') {
          throw new AppError('VALIDATION_FAILED', {
            errors: [{ path: 'competitionId', message: 'Escolha uma competição publicada.' }],
          });
        }
      }
      await tx.competition.updateMany({ where: { isFeatured: true }, data: { isFeatured: false } });
      if (competitionId) {
        await tx.competition.update({ where: { id: competitionId }, data: { isFeatured: true } });
      }
      await this.audit.record(
        {
          action: 'competition.featured_changed',
          actorUserId: actor.user.id,
          entityType: 'competition',
          entityId: competitionId ?? undefined,
          metadata: { from: previous?.id ?? null, to: competitionId },
          context,
        },
        tx,
      );
    });
    return this.competitionOptions();
  }
}
