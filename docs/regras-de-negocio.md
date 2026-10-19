# Regras de negócio

Regras **em vigor no código**, em linguagem de negócio. Cada fase acrescenta as suas. Onde há um
número (prazo, limite), ele é o valor padrão e pode ser ajustado por configuração.

## Contas

| #   | Regra                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------- |
| C1  | O cadastro exige e-mail, nome de usuário, nome de exibição, senha e o aceite do Aviso de Privacidade.                             |
| C2  | E-mail e nome de usuário são únicos e não diferenciam maiúsculas. O nome de usuário é fixo.                                       |
| C3  | Toda conta nasce com o papel de Jogador e só pode entrar depois de confirmar o e-mail (link válido por 24 h).                     |
| C4  | Uma conta nunca é apagada: o histórico esportivo e a auditoria dependem dela.                                                     |
| C5  | Situações: aguardando verificação → ativa ⇄ suspensa. "Desativada" está reservada para o encerramento a pedido (ainda sem fluxo). |

## Acesso

| #   | Regra                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Após 5 senhas ou códigos incorretos seguidos, a conta fica bloqueada por 1 minuto; o bloqueio dobra a cada nova falha, até 15 minutos. Um login correto ou a redefinição de senha zera a contagem. |
| A2  | A sessão expira por inatividade (7 dias; 2 horas para contas administrativas) e, em qualquer caso, 30 dias após o login.                                                                           |
| A3  | Trocar a senha encerra as outras sessões; redefinir a senha pelo e-mail encerra todas.                                                                                                             |
| A4  | O link de redefinição vale 30 minutos e funciona uma única vez.                                                                                                                                    |
| A5  | Quem ativa a verificação em duas etapas recebe 10 códigos de recuperação, cada um de uso único.                                                                                                    |
| A6  | Administradores e superadministradores **só administram com a verificação em duas etapas ativa** e não podem desativá-la.                                                                          |

## Papéis e administração de usuários

| Papel              | Pode                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Superadministrador | Tudo, inclusive conceder e revogar qualquer papel.                                                                                       |
| Administrador      | Ver o dashboard, os usuários e a auditoria; suspender e reativar contas; conceder e revogar os papéis de Organizador, Árbitro e Jogador. |
| Organizador        | _Ainda sem permissões próprias_ — chegam com as competições (Fase 3).                                                                    |
| Árbitro            | _Ainda sem permissões próprias_ — chegam com os resultados (Fase 5).                                                                     |
| Jogador            | Gerenciar a própria conta.                                                                                                               |

| #   | Regra                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Ninguém altera os próprios papéis nem a própria situação.                                                                       |
| P2  | Um administrador não altera contas de administradores ou de superadministradores.                                               |
| P3  | Toda conta tem ao menos um papel, e a federação sempre mantém ao menos um superadministrador ativo.                             |
| P4  | Suspender exige um motivo, encerra imediatamente todas as sessões da conta e impede novos logins. Reativar também exige motivo. |
| P5  | A revogação de um papel vale a partir da requisição seguinte.                                                                   |

## Auditoria

| #   | Regra                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | São registrados: cadastro, verificação de e-mail, logins (com sucesso e com falha), segundo fator, logout, alterações de senha, de MFA e de sessões, alterações de perfil e todas as ações administrativas. |
| U2  | O registro guarda quem fez, sobre o quê, quando, de onde e — nas ações administrativas — o motivo.                                                                                                          |
| U3  | Registros de auditoria não podem ser alterados nem apagados, nem mesmo por um administrador.                                                                                                                |
| U4  | Senhas, códigos e tokens nunca aparecem na auditoria.                                                                                                                                                       |
