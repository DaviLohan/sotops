import type { Route } from 'next';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';

const COLUMNS: { title: string; links: { href: Route; label: string }[] }[] = [
  {
    title: 'Federação',
    links: [
      { href: '/#competicoes' as Route, label: 'Competições' },
      { href: '/#classificacao' as Route, label: 'Classificação' },
      { href: '/#ranking' as Route, label: 'Ranking' },
      { href: '/jogadores', label: 'Jogadores' },
      { href: '/clubes', label: 'Clubes' },
      { href: '/#noticias' as Route, label: 'Notícias' },
    ],
  },
  {
    title: 'Sua conta',
    links: [
      { href: '/cadastro', label: 'Criar conta' },
      { href: '/entrar', label: 'Entrar' },
      { href: '/recuperar-senha', label: 'Recuperar senha' },
    ],
  },
  {
    title: 'Legal',
    links: [{ href: '/privacidade', label: 'Aviso de Privacidade' }],
  },
];

/** Rodapé enxuto. Só links que existem: páginas novas entram aqui quando forem publicadas. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-canvas-deep">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div className="max-w-sm">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9" />
            <p className="type-display type-h3 text-fg">Federação eFootball 1x1</p>
          </div>
          <p className="type-small mt-4 text-fg-subtle">
            Federação independente de eFootball 1x1. Sem vínculo com a Konami; eFootball é marca de
            sua respectiva titular.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="type-eyebrow text-fg-subtle">{column.title}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="type-small rounded-sm text-fg-muted hover:text-fg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
