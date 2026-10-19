/**
 * Navegação com recarga completa da página.
 *
 * Usada apenas nas fronteiras de sessão (entrar, sair, sessão expirada): descarta o cache do
 * TanStack Query e qualquer estado em memória da sessão anterior, e faz o servidor renderizar
 * a próxima tela já com o novo cookie. Para qualquer outra navegação, use `<Link>` ou `useRouter`.
 */
export function navigateWithReload(path: string): void {
  window.location.assign(path);
}
