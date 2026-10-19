import type { NewsItem } from '@efed/shared';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { SectionHeader } from '../sport/section-header';

/** Só imagens do próprio site: a política de conteúdo do portal não carrega imagens de terceiros. */
function localImage(url: string | null): string | null {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : null;
}

function NewsVisual({ item, className }: { item: NewsItem; className?: string }) {
  const src = localImage(item.imageUrl);
  return (
    <div className={cn('relative isolate overflow-hidden bg-surface-raised', className)}>
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-cover"
        />
      ) : (
        <>
          <svg
            aria-hidden="true"
            viewBox="0 0 400 240"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 size-full text-white/[0.07]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="300" cy="120" r="80" />
            <path d="M300 0v240M0 120h400" />
            <circle cx="300" cy="120" r="4" fill="currentColor" />
          </svg>
          <span
            className="type-display absolute bottom-3 left-4 text-5xl text-fg/10 select-none"
            aria-hidden="true"
          >
            {item.category}
          </span>
        </>
      )}
    </div>
  );
}

function Meta({ item }: { item: NewsItem }) {
  return (
    <p className="type-eyebrow flex items-center gap-3 text-fg-subtle">
      <span className="text-accent">{item.category}</span>
      <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
    </p>
  );
}

/** Notícias em layout editorial: uma matéria principal e as demais em lista. */
export function NewsSection({ featured, items }: { featured: NewsItem | null; items: NewsItem[] }) {
  return (
    <section
      id="noticias"
      aria-labelledby="noticias-titulo"
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <SectionHeader
        id="noticias-titulo"
        eyebrow="Comunicados e cobertura"
        title="Últimas notícias"
      />
      {!featured ? (
        <p className="type-body mt-8 border border-dashed border-border-strong p-6 text-fg-muted">
          Ainda não há notícias publicadas.
        </p>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <article>
            <NewsVisual item={featured} className="aspect-[16/9]" />
            <div className="mt-5">
              <Meta item={featured} />
              <h3 className="type-display type-h1 mt-3 text-fg">{featured.title}</h3>
              <p className="type-lead mt-3 max-w-2xl text-fg-muted">{featured.summary}</p>
            </div>
          </article>
          <ol className="flex flex-col">
            {items.map((item) => (
              <li
                key={item.slug}
                className="border-t border-border py-5 first:border-t-0 first:pt-0 lg:first:border-t lg:first:pt-5"
              >
                <article>
                  <Meta item={item} />
                  <h3 className="type-display type-h3 mt-2 text-fg">{item.title}</h3>
                  <p className="type-small mt-2 line-clamp-2 text-fg-muted">{item.summary}</p>
                </article>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
