import { type NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAMES = ['__Host-efed_session', 'efed_session'];

/** Lido a cada requisição: o endereço da API é configuração de execução, não de build. */
function apiInternalUrl(): string {
  return process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Em desenvolvimento, o Next.js encaminha /api para a API e mantém o cookie de sessão na
  // mesma origem do frontend. Em produção, o proxy reverso faz esse roteamento antes de
  // a requisição chegar aqui.
  if (pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, apiInternalUrl()));
  }

  // Redirecionamento otimista: sem cookie de sessão, nem tenta renderizar as áreas
  // autenticadas. Não é um controle de segurança — a validade da sessão e as permissões são
  // verificadas pela API em cada requisição.
  const hasSessionCookie = SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name));
  if (hasSessionCookie) {
    return NextResponse.next();
  }
  const loginUrl = new URL('/entrar', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/api/:path*', '/painel/:path*', '/admin/:path*'],
};
