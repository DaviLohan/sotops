# 01 · Análise de requisitos

Leitura do documento de requisitos como arquiteto: o que o produto precisa fazer, onde está o risco
e o que ainda precisa ser decidido pela federação antes de cada fase.

## 1. O produto em uma frase

Uma federação de eFootball 1x1 organiza competições, e a plataforma garante que **cada resultado
oficial tem evidência, confirmação e registro** — a central de reporte por OCR reduz o trabalho de
digitar placares, mas quem torna um resultado oficial é sempre um processo auditável do backend.

## 2. Atores

| Ator               | O que faz                                                        | Como é identificado                 |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------- |
| Visitante          | Consulta o portal público                                        | Sem conta (não é um papel no banco) |
| Jogador            | Gerencia conta, inscrições e partidas; reporta e confirma placar | Papel `PLAYER`                      |
| Árbitro            | Analisa resultados, contestações e evidências                    | Papel `REFEREE`, por competição     |
| Organizador        | Gerencia as competições a que está vinculado                     | Papel `ORGANIZER`, por competição   |
| Administrador      | Administra participantes, competições, resultados e relatórios   | Papel `ADMIN` + MFA                 |
| Superadministrador | Tudo, inclusive configurações e gestão de administradores        | Papel `SUPER_ADMIN` + MFA           |

Um usuário pode acumular papéis (ex.: organizador que também joga).

## 3. Áreas funcionais e a fase em que entram

| Área                                                  | Fase | Observação                         |
| ----------------------------------------------------- | ---- | ---------------------------------- |
| Identidade, sessões, MFA, permissões, auditoria       | 1    | **Entregue**                       |
| Design system e estrutura dos três ambientes          | 1    | **Entregue**                       |
| Jogadores, clubes, vínculos e transferências          | 2    |                                    |
| Configurações gerais, perfis públicos                 | 2    |                                    |
| Temporadas, campeonatos, regras, inscrições           | 3    |                                    |
| Geração de confrontos, calendário, estados            | 3    | Motor independente da interface    |
| Upload de evidências, fila, serviço de OCR            | 4    | Depende de capturas reais (ver §6) |
| Confirmação, contestação, homologação                 | 5    |                                    |
| Classificação, estatísticas, rankings, notificações   | 5    |                                    |
| Justiça desportiva (processos, penalidades, recursos) | 5    |                                    |
| Endurecimento, monitoramento, backups externos        | 6    |                                    |

## 4. Requisitos não funcionais que moldam a arquitetura

- **Integridade acima de tudo.** Resultado oficial, classificação e auditoria não podem divergir.
  Consequências: classificação derivada exclusivamente de resultados homologados; correções por
  revisão versionada, nunca por edição; operações críticas transacionais e idempotentes.
- **Histórico imutável.** Transferência não altera quem representou o clube em partida passada;
  mudança de nome não apaga histórico. Consequência: a inscrição em um campeonato guarda uma
  _fotografia_ do vínculo, e as partidas apontam para a inscrição.
- **Autorização no backend**, por papel e por recurso.
- **OCR como assistente, não como juiz.** Confiança alta não homologa sozinha.
- **Operação real**: Docker, health checks, backups, logs estruturados, segredos fora do código.
- **LGPD desde a modelagem**: minimização, base legal registrada, eliminação por anonimização.
- **Uso em celular** como cenário principal do jogador (enviar a captura logo após a partida).

## 5. Riscos principais

| Risco                                                           | Mitigação                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| OCR impreciso em layouts, idiomas ou resoluções não previstos   | Modelos de layout versionados; confiança por campo; revisão humana como caminho padrão        |
| Fraude por captura reutilizada ou adulterada                    | SHA-256 + hash perceptual; confirmação do adversário; alertas para análise, não acusações     |
| Homologação duplicada sob concorrência                          | Restrição de unicidade + transição de estado condicional + chave de idempotência              |
| Classificação errada após correção de resultado                 | Recalcular a partir dos resultados oficiais na mesma transação da revisão                     |
| Regulamentos muito diferentes entre competições                 | Regras como configuração por campeonato (pontuação, desempates, prazos), validadas por schema |
| Dependência de integração não oficial com o jogo                | Nenhuma: o fluxo funciona só com capturas enviadas pelos participantes                        |
| Bloqueio de conta usado para derrubar um jogador antes do prazo | Bloqueio curto e progressivo (máx. 15 min) + limite por IP; revisão na Fase 6                 |

## 6. Decisões em aberto (precisam da federação)

Nenhuma bloqueou a Fase 1. Cada uma está associada à fase que ela trava.

| #   | Decisão                                                                                                  | Trava a fase |
| --- | -------------------------------------------------------------------------------------------------------- | ------------ |
| D1  | **Capturas reais** da tela de resultado do eFootball, por plataforma, resolução e idioma (ver `08`)      | 4            |
| D2  | ✅ ID do usuário, único por plataforma (ADR 0010)                                                        | 2            |
| D3  | ✅ Vários jogadores por clube; jogar sem clube é permitido; clube aceita e federação aprova (ADR 0010)   | 2            |
| D4  | Regra para reporte sem resposta do adversário (homologação tácita após o prazo ou sempre análise humana) | 5            |
| D5  | Critérios de W.O. e placar atribuído; prazos padrão de reporte e de confirmação                          | 3 e 5        |
| D6  | Fórmula dos rankings (geral, por temporada, de clubes)                                                   | 5            |
| D7  | Provedor de e-mail (SMTP) de produção e domínio da federação                                             | produção     |
| D8  | LGPD: quem é o controlador, canal do encarregado e prazos de retenção de evidências e sessões            | produção     |
| D9  | Onde a plataforma será hospedada (um servidor com Docker é o pressuposto atual)                          | 6            |
| D10 | Nome e marca definitivos. Hoje: provisório, nome editável no painel (ADR 0010); logotipo aguarda a marca | 2            |

## 7. Pontos do documento original que foram interpretados

- **"Visitante" como perfil de acesso**: tratado como ausência de sessão, não como papel no banco.
- **Tabelas `ties` e `tie_games`**: uma "tie_game" é uma partida; o modelo proposto relaciona
  `matches` a `ties` diretamente (ver `05`), evitando duas entidades para o mesmo fato.
- **BullMQ no serviço Python**: o BullMQ é uma biblioteca Node; a proposta é a fila ficar na API e o
  serviço de OCR ser chamado por HTTP interno, sem acesso ao banco (ver `08` e o ADR 0005).
- **`packages/ui`**: o design system vive em `apps/web` enquanto houver um único consumidor (ADR 0003).
- **"Dashboard com indicadores reais" na Fase 1**: os indicadores disponíveis hoje são os de
  usuários, sessões e segurança — calculados do banco. Os de competições entram com seus módulos.
