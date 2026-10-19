import type { ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

/** Moldura comum das telas de acesso: título, formulário e links secundários. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div>
      <h1 className="type-display text-4xl text-fg">{title}</h1>
      {description ? <p className="mt-3 text-sm text-fg-muted">{description}</p> : null}
      <div className="mt-8">{children}</div>
      {footer ? (
        <div className="mt-8 border-t border-border pt-6 text-sm text-fg-muted">{footer}</div>
      ) : null}
    </div>
  );
}
