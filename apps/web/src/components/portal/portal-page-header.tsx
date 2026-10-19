import type { ReactNode } from 'react';

/** Abertura das páginas internas do portal: mesma linguagem das seções da HOME, com o h1. */
export function PortalPageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-surface-sunken">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="type-eyebrow flex items-center gap-2 text-accent">
          <span className="h-px w-6 bg-accent" aria-hidden="true" />
          {eyebrow}
        </p>
        <h1 className="type-display type-xl mt-3 text-fg">{title}</h1>
        {description ? (
          <p className="type-body mt-3 max-w-2xl text-fg-muted">{description}</p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </div>
  );
}
