import type { Banner, CompetitionCard, PublicMatch } from '@efed/shared';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '../ui/button';
import { ClubBadge } from '../sport/club-badge';
import { kickoffLabel, pad2 } from '@/lib/portal';

/** O destino do banner vem do banco: só caminhos internos são aceitos. */
function internalHref(href: string | null): Route | null {
  return href && href.startsWith('/') && !href.startsWith('//') ? (href as Route) : null;
}

/** A política de conteúdo só carrega imagens do próprio site. */
function localImage(url: string | null | undefined): string | null {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
}

function PitchMarks() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 800 800"
      className="absolute top-1/2 right-0 h-[130%] w-auto -translate-y-1/2 translate-x-[28%] text-white/[0.09]"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
    >
      <circle cx="400" cy="400" r="170" />
      <circle cx="400" cy="400" r="6" fill="currentColor" />
      <path d="M400 0v800" />
      <rect x="-120" y="190" width="290" height="420" />
      <path d="M170 320a110 110 0 0 1 0 160" />
    </svg>
  );
}

/**
 * Hero da HOME. Sem foto de banco de imagens: a composição usa as marcações do campo e o número
 * da rodada em curso como elemento gráfico, então o "visual" já é conteúdo real da plataforma.
 * O painel inferior mostra a próxima partida verdadeira.
 */
export function Hero({
  banner,
  competition,
  nextMatch,
  signedIn,
  now,
}: {
  banner: Banner | null;
  competition: CompetitionCard | null;
  nextMatch: PublicMatch | null;
  signedIn: boolean;
  now: Date;
}) {
  const cta = internalHref(banner?.ctaHref ?? null) ?? ('/cadastro' as Route);
  const round = competition?.currentRound ?? null;
  const image = localImage(banner?.imageUrl);
  return (
    <section className="relative isolate -mt-16 flex min-h-[max(36rem,86svh)] flex-col overflow-hidden border-b border-border bg-canvas-deep">
      {image ? (
        <>
          {/* Foto do banner: o jogador fica à esquerda e o texto ocupa o céu, à direita. */}
          <Image
            src={image}
            alt=""
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[28%_center] md:object-left"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,var(--canvas-deep)_4%,color-mix(in_oklab,var(--canvas-deep)_55%,transparent)_38%,transparent_70%)] max-md:bg-[linear-gradient(to_top,var(--canvas-deep)_18%,color-mix(in_oklab,var(--canvas-deep)_78%,transparent)_52%,color-mix(in_oklab,var(--canvas-deep)_25%,transparent)_100%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 -z-10 h-32 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--canvas-deep)_80%,transparent),transparent)]"
          />
        </>
      ) : (
        <>
          {/* Sem foto: faixa azul diagonal, marcações do campo e o número da rodada. */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 -z-10 w-full bg-brand [clip-path:polygon(62%_0,100%_0,100%_100%,38%_100%)] opacity-90 max-lg:[clip-path:polygon(78%_0,100%_0,100%_100%,58%_100%)] max-lg:opacity-55"
          />
          <div
            aria-hidden="true"
            className="absolute inset-y-0 right-0 -z-10 w-full bg-[linear-gradient(90deg,var(--canvas-deep)_38%,transparent_75%)]"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
            <PitchMarks />
          </div>
          {round !== null ? (
            <span
              aria-hidden="true"
              className="ghost-numeral pointer-events-none absolute right-[4%] bottom-[14%] -z-10 hidden text-[22rem] select-none md:block lg:text-[30rem]"
            >
              {pad2(round)}
            </span>
          ) : null}
        </>
      )}

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pt-28 pb-10 sm:px-6 md:justify-center lg:px-8">
        <div className={image ? 'lg:ml-auto lg:w-[52%]' : undefined}>
          <p className="type-eyebrow flex items-center gap-2 text-accent">
            <span className="h-px w-8 bg-accent" aria-hidden="true" />
            {banner?.eyebrow ?? 'Federação de eFootball · 1 contra 1'}
          </p>
          <h1 className="type-display type-xxl mt-5 max-w-3xl text-fg">
            {banner?.title ?? 'Campeonatos 1x1 com resultado conferido.'}
          </h1>
          {banner?.subtitle ? (
            <p className="type-lead mt-6 max-w-md text-fg-muted">{banner.subtitle}</p>
          ) : null}
          <div className="mt-9 flex flex-wrap gap-3">
            {signedIn ? (
              <Button asChild variant="primary" size="lg">
                <Link href="/painel">Abrir meu painel</Link>
              </Button>
            ) : (
              <Button asChild variant="primary" size="lg">
                <Link href={cta}>{banner?.ctaLabel ?? 'Criar minha conta'}</Link>
              </Button>
            )}
            <Button asChild variant="secondary" size="lg">
              <Link href="/#competicoes">Ver competições</Link>
            </Button>
          </div>
        </div>
      </div>

      {nextMatch ? (
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="clip-notch border border-border-strong bg-canvas-deep/90 backdrop-blur-sm">
            <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:gap-8">
              <div className="md:w-44">
                <p className="type-eyebrow text-accent">Próxima partida</p>
                <p className="type-display mt-1 text-2xl text-fg">
                  {kickoffLabel(nextMatch.scheduledAt, now)}
                </p>
              </div>
              <div className="flex flex-1 items-center justify-between gap-3 sm:justify-center sm:gap-8">
                <span className="flex min-w-0 items-center gap-3">
                  <ClubBadge club={nextMatch.home.club} size="lg" />
                  <span className="type-display type-h3 truncate text-fg">
                    {nextMatch.home.nickname}
                  </span>
                </span>
                <span className="type-display text-base tracking-widest text-fg-subtle">VS</span>
                <span className="flex min-w-0 flex-row-reverse items-center gap-3 sm:flex-row">
                  <span className="type-display type-h3 truncate text-fg">
                    {nextMatch.away.nickname}
                  </span>
                  <ClubBadge club={nextMatch.away.club} size="lg" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 md:w-56 md:flex-col md:items-end md:justify-center md:gap-1">
                <p className="type-small text-fg-muted">
                  {nextMatch.competition.name} · Rodada {pad2(nextMatch.round)}
                </p>
                <Link
                  href="/#partidas"
                  className="type-eyebrow text-link underline-offset-4 hover:underline"
                >
                  Ver confrontos
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
