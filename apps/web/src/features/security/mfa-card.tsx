'use client';

import type {
  ApiResponse,
  MfaEnrollmentDto,
  MfaRecoveryCodesDto,
  MfaStatusDto,
} from '@efed/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeInput } from '@/components/ui/code-input';
import { Dialog, DialogBody, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { formatDate } from '@/lib/format';
import { RecoveryCodes } from './recovery-codes';

type Flow = 'enroll' | 'regenerate' | 'disable' | null;

export function MfaCard() {
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [flow, setFlow] = useState<Flow>(null);

  const status = useQuery({
    queryKey: ['mfa-status'],
    queryFn: ({ signal }) => api.get<ApiResponse<MfaStatusDto>>('/auth/mfa', undefined, signal),
    select: (response) => response.data,
  });

  async function closeFlow(changed: boolean) {
    setFlow(null);
    if (changed) {
      await queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      // As permissões dependem do MFA: recarrega os dados da sessão vindos do servidor.
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Verificação em duas etapas</CardTitle>
          <CardDescription>
            Além da senha, o login pede um código do seu aplicativo autenticador.
          </CardDescription>
        </div>
        {status.data ? (
          <Badge tone={status.data.enabled ? 'success' : 'warning'} dot>
            {status.data.enabled ? 'Ativa' : 'Inativa'}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {status.isPending ? (
          <Skeleton className="h-16" />
        ) : status.isError ? (
          <Callout
            tone="danger"
            title={messageFor(status.error)}
            action={
              <Button size="sm" onClick={() => status.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        ) : status.data.enabled ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
              <p className="text-sm text-fg-muted">
                Ativa desde {status.data.enabledAt ? formatDate(status.data.enabledAt) : '—'}.{' '}
                <span
                  className={status.data.recoveryCodesRemaining <= 2 ? 'text-warning' : undefined}
                >
                  {status.data.recoveryCodesRemaining} códigos de recuperação restantes.
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setFlow('regenerate')}>
                Gerar novos códigos de recuperação
              </Button>
              {status.data.required ? null : (
                <Button size="sm" variant="danger" onClick={() => setFlow('disable')}>
                  Desativar
                </Button>
              )}
            </div>
            {status.data.required ? (
              <p className="text-[0.8125rem] text-fg-subtle">
                Seu papel na federação exige a verificação em duas etapas; ela não pode ser
                desativada.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
              <p className="text-sm text-fg-muted">
                {status.data.required
                  ? 'Seu papel na federação exige a verificação em duas etapas. Ative para liberar o painel administrativo.'
                  : 'Sua conta depende apenas da senha. Ativar o segundo fator impede o acesso de quem descobrir sua senha.'}
              </p>
            </div>
            <div>
              <Button variant="primary" onClick={() => setFlow('enroll')}>
                Ativar verificação em duas etapas
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog
        open={flow === 'enroll'}
        onOpenChange={(open) => (open ? undefined : void closeFlow(true))}
      >
        {flow === 'enroll' ? <EnrollDialog onDone={() => closeFlow(true)} /> : null}
      </Dialog>
      <Dialog
        open={flow === 'regenerate'}
        onOpenChange={(open) => (open ? undefined : void closeFlow(true))}
      >
        {flow === 'regenerate' ? <RegenerateDialog onDone={() => closeFlow(true)} /> : null}
      </Dialog>
      <Dialog
        open={flow === 'disable'}
        onOpenChange={(open) => (open ? undefined : void closeFlow(false))}
      >
        {flow === 'disable' ? (
          <DisableDialog onDone={() => closeFlow(true)} onCancel={() => closeFlow(false)} />
        ) : null}
      </Dialog>
    </Card>
  );
}

/** Pede a senha atual antes de uma operação sensível e devolve o resultado da chamada. */
function PasswordStep<Result>({
  submitLabel,
  tone = 'primary',
  request,
  onResult,
  children,
}: {
  submitLabel: string;
  tone?: 'primary' | 'danger';
  request: (password: string) => Promise<Result>;
  onResult: (result: Result) => void;
  children?: React.ReactNode;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) {
      setError('Informe sua senha.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onResult(await request(password));
    } catch (caught) {
      setSubmitting(false);
      setError(
        caught instanceof ApiError && caught.code === 'INVALID_CREDENTIALS'
          ? 'A senha informada está incorreta.'
          : messageFor(caught),
      );
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="contents">
      <DialogBody className="flex flex-col gap-5">
        {children}
        <FormField label="Sua senha atual" error={error ?? undefined}>
          <PasswordInput
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button type="submit" variant={tone} loading={submitting}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EnrollDialog({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const [enrollment, setEnrollment] = useState<MfaEnrollmentDto | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  // Um único DialogContent para todos os passos: só o miolo muda, sem reabrir o modal.
  const step = recoveryCodes ? 'codes' : enrollment ? 'confirm' : 'password';
  const header = {
    password: {
      title: 'Ativar verificação em duas etapas',
      description: 'Passo 1 de 2 · Confirme que é você.',
    },
    confirm: {
      title: 'Ativar verificação em duas etapas',
      description:
        'Passo 2 de 2 · Leia o QR code no aplicativo autenticador e informe o código gerado.',
    },
    codes: { title: 'Verificação em duas etapas ativada', description: undefined },
  }[step];

  return (
    <DialogContent
      title={header.title}
      description={header.description}
      onInteractOutside={(event) => (step === 'codes' ? event.preventDefault() : undefined)}
    >
      {recoveryCodes ? (
        <>
          <DialogBody>
            <RecoveryCodes codes={recoveryCodes} />
          </DialogBody>
          <DialogFooter>
            <Button variant="primary" onClick={onDone}>
              Guardei os códigos
            </Button>
          </DialogFooter>
        </>
      ) : enrollment ? (
        <ConfirmStep enrollment={enrollment} onConfirmed={setRecoveryCodes} />
      ) : (
        <PasswordStep
          submitLabel="Continuar"
          request={async (password) =>
            (
              await api.send<ApiResponse<MfaEnrollmentDto>>('POST', '/auth/mfa/enrollment', {
                password,
              })
            ).data
          }
          onResult={setEnrollment}
        />
      )}
    </DialogContent>
  );
}

function ConfirmStep({
  enrollment,
  onConfirmed,
}: {
  enrollment: MfaEnrollmentDto;
  onConfirmed: (codes: string[]) => void;
}) {
  const api = useApi();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(enrollment.otpauthUri, { margin: 1, width: 192, errorCorrectionLevel: 'M' })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrCode(dataUrl);
        }
      })
      .catch(() => setQrCode(null));
    return () => {
      cancelled = true;
    };
  }, [enrollment.otpauthUri]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('O código deve ter 6 dígitos.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.send<ApiResponse<MfaRecoveryCodesDto>>(
        'POST',
        '/auth/mfa/enrollment/confirm',
        { code },
      );
      onConfirmed(data.recoveryCodes);
    } catch (caught) {
      setSubmitting(false);
      setCode('');
      setError(messageFor(caught));
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="contents">
      <DialogBody className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex size-48 shrink-0 items-center justify-center rounded-lg bg-white p-2">
            {qrCode ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem gerada localmente (data URL)
              <img
                src={qrCode}
                alt="QR code para o aplicativo autenticador"
                width={176}
                height={176}
              />
            ) : (
              <Skeleton className="size-full bg-black/10" />
            )}
          </div>
          <div className="min-w-0 text-sm text-fg-muted">
            <p>Não consegue ler o QR code? Digite esta chave no aplicativo:</p>
            <p
              data-testid="totp-secret"
              className="mt-2 rounded-md border border-border bg-surface-sunken p-2.5 font-mono text-[0.8125rem] break-all text-fg select-all"
            >
              {enrollment.secret}
            </p>
          </div>
        </div>
        <FormField label="Código de 6 dígitos" error={error ?? undefined}>
          <CodeInput
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
        </FormField>
      </DialogBody>
      <DialogFooter>
        <Button type="submit" variant="primary" loading={submitting}>
          Ativar
        </Button>
      </DialogFooter>
    </form>
  );
}

function RegenerateDialog({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  return (
    <DialogContent
      title={recoveryCodes ? 'Novos códigos de recuperação' : 'Gerar novos códigos de recuperação'}
      description={
        recoveryCodes ? undefined : 'Os códigos atuais deixam de funcionar imediatamente.'
      }
      onInteractOutside={(event) => (recoveryCodes ? event.preventDefault() : undefined)}
    >
      {recoveryCodes ? (
        <>
          <DialogBody>
            <RecoveryCodes codes={recoveryCodes} />
          </DialogBody>
          <DialogFooter>
            <Button variant="primary" onClick={onDone}>
              Guardei os códigos
            </Button>
          </DialogFooter>
        </>
      ) : (
        <PasswordStep
          submitLabel="Gerar novos códigos"
          request={async (password) =>
            (
              await api.send<ApiResponse<MfaRecoveryCodesDto>>('POST', '/auth/mfa/recovery-codes', {
                password,
              })
            ).data.recoveryCodes
          }
          onResult={setRecoveryCodes}
        />
      )}
    </DialogContent>
  );
}

function DisableDialog({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const api = useApi();
  return (
    <DialogContent
      title="Desativar verificação em duas etapas"
      description="Sua conta voltará a depender apenas da senha."
    >
      <PasswordStep
        submitLabel="Desativar"
        tone="danger"
        request={(password) => api.send('POST', '/auth/mfa/disable', { password })}
        onResult={() => {
          toast.success('Verificação em duas etapas desativada.');
          onDone();
        }}
      >
        <Callout tone="warning">
          As sessões abertas em outros dispositivos serão encerradas.{' '}
          <button
            type="button"
            onClick={onCancel}
            className="font-medium text-link hover:underline"
          >
            Manter ativa
          </button>
        </Callout>
      </PasswordStep>
    </DialogContent>
  );
}
