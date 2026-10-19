import { PRIVACY_NOTICE_VERSION } from '@efed/shared';
import type { Metadata } from 'next';
import { Callout } from '@/components/ui/callout';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Aviso de Privacidade' };

const SECTIONS = [
  {
    title: 'Quais dados tratamos',
    items: [
      'Cadastro: e-mail, nome de usuário e nome de exibição.',
      'Acesso: senha armazenada apenas como hash Argon2id, nunca em texto legível.',
      'Sessões: endereço IP, navegador e horários de acesso, para que você reconheça e encerre sessões.',
      'Segurança: segredo da verificação em duas etapas, cifrado, quando você a ativa.',
      'Perfil de jogador, quando você o cria: apelido, ID e plataforma no eFootball, país, região (opcional) e avatar. A imagem do avatar é regravada pela plataforma, sem os metadados do arquivo original (como localização).',
      'Clubes: vínculos com início e fim, e os pedidos de transferência com as respectivas decisões.',
      'Auditoria: registro de ações sensíveis na conta (login, troca de senha, alterações administrativas).',
    ],
  },
  {
    title: 'Para que usamos',
    items: [
      'Criar e proteger a sua conta e permitir o acesso à plataforma.',
      'Organizar as competições e manter o histórico esportivo da federação.',
      'Prevenir fraude e uso indevido, e apurar contestações.',
    ],
  },
  {
    title: 'Com quem compartilhamos',
    items: [
      'Nome de usuário e nome de exibição são públicos dentro da plataforma.',
      'No portal, a página pública do jogador mostra apelido, país, região, plataforma, avatar, clube atual, clubes anteriores e resultados oficiais. O ID do eFootball não é exibido publicamente; ele é visível para a administração e, a partir das competições, para os adversários.',
      'E-mail, dados de sessão e registros de auditoria são acessíveis apenas à administração da federação, conforme o papel de cada pessoa.',
      'Não vendemos dados pessoais.',
    ],
  },
  {
    title: 'Seus direitos',
    items: [
      'Confirmar o tratamento, acessar, corrigir e pedir a eliminação dos seus dados, nos termos da LGPD (Lei nº 13.709/2018).',
      'Resultados e registros esportivos oficiais são preservados para a integridade das competições; quando houver pedido de eliminação, os dados que identificam você são anonimizados.',
    ],
  },
] as const;

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="type-eyebrow text-accent">Institucional</p>
      <h1 className="type-display mt-3 text-4xl text-fg sm:text-5xl">Aviso de Privacidade</h1>
      <p className="mt-4 text-sm text-fg-muted">
        Versão de {formatDate(`${PRIVACY_NOTICE_VERSION}T12:00:00Z`)}. Este aviso descreve os dados
        tratados pela plataforma na versão atual.
      </p>

      <Callout tone="info" className="mt-8" title="Documento em elaboração">
        O texto abaixo reflete fielmente o que o sistema coleta hoje. A identificação do
        controlador, o canal do encarregado e os prazos de retenção precisam ser definidos pela
        federação e revisados juridicamente antes da abertura ao público.
      </Callout>

      <div className="mt-10 flex flex-col gap-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-lg font-semibold text-fg">{section.title}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-fg-muted marker:text-fg-subtle">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
