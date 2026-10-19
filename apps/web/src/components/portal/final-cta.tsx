import type { Route } from 'next';
import Link from 'next/link';
import { Button } from '../ui/button';

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section
      aria-labelledby="cta-final"
      className="relative isolate overflow-hidden border-t border-border bg-canvas-deep"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 800 400"
        preserveAspectRatio="xMaxYMid slice"
        className="absolute inset-y-0 right-0 -z-10 h-full w-full text-white/[0.06] sm:w-2/3"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      >
        <circle cx="560" cy="200" r="150" />
        <circle cx="560" cy="200" r="5" fill="currentColor" />
        <path d="M560 0v400" />
      </svg>
      <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <h2 id="cta-final" className="type-display type-xxl max-w-2xl text-fg">
          Sua história <span className="text-accent">começa aqui.</span>
        </h2>
        <p className="type-lead mt-5 max-w-md text-fg-muted">
          Entre nas competições oficiais da Federação.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {signedIn ? (
            <Button asChild variant="primary" size="lg">
              <Link href="/painel">Abrir meu painel</Link>
            </Button>
          ) : (
            <Button asChild variant="primary" size="lg">
              <Link href="/cadastro">Criar conta</Link>
            </Button>
          )}
          <Button asChild variant="secondary" size="lg">
            <Link href={'/#competicoes' as Route}>Ver campeonatos</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
