'use client';

import {
  type AdminUserDto,
  type ApiResponse,
  assignableRolesFor,
  ROLE_KEYS,
  ROLE_LABELS,
  type RoleKey,
  type UpdateUserStatusInput,
  updateUserStatusSchema,
} from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/input';
import { messageFor } from '@/lib/api/errors';
import { useApi, useSession } from '@/lib/auth/session-context';

const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  SUPER_ADMIN: 'Acesso completo, incluindo a gestão de administradores.',
  ADMIN: 'Administra usuários, auditoria e os recursos da federação.',
  ORGANIZER: 'Gerencia as competições às quais estiver vinculado.',
  REFEREE: 'Analisa resultados, contestações e evidências.',
  PLAYER: 'Participa das competições.',
};

interface UserDialogProps {
  user: AdminUserDto;
  onClose: () => void;
}

export function RolesDialog({ user, onClose }: UserDialogProps) {
  const api = useApi();
  const { account } = useSession();
  const queryClient = useQueryClient();
  const assignable = assignableRolesFor(account.roles);
  const [selected, setSelected] = useState<RoleKey[]>(user.roles);

  const mutation = useMutation({
    mutationFn: () =>
      api.send<ApiResponse<AdminUserDto>>('PUT', `/admin/users/${user.id}/roles`, {
        roles: selected,
      }),
    onSuccess: async () => {
      toast.success(`Papéis de @${user.username} atualizados.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
  });

  const unchanged =
    selected.length === user.roles.length && selected.every((role) => user.roles.includes(role));
  const grantsAdminRole = selected.some(
    (role) => (role === 'ADMIN' || role === 'SUPER_ADMIN') && !user.roles.includes(role),
  );

  function toggle(role: RoleKey, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, role] : current.filter((item) => item !== role),
    );
  }

  return (
    <DialogContent title="Gerenciar papéis" description={`${user.displayName} · @${user.username}`}>
      <DialogBody className="flex flex-col gap-4">
        {mutation.isError ? <Callout tone="danger" title={messageFor(mutation.error)} /> : null}
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Papéis da conta</legend>
          {ROLE_KEYS.map((role) => {
            const id = `role-${role}`;
            const allowed = assignable.includes(role);
            return (
              <div
                key={role}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-surface-raised/60"
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(role)}
                  disabled={!allowed}
                  onCheckedChange={(checked) => toggle(role, checked === true)}
                  aria-describedby={`${id}-description`}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <label htmlFor={id} className="text-sm font-medium text-fg">
                    {ROLE_LABELS[role]}
                  </label>
                  <p id={`${id}-description`} className="text-[0.8125rem] text-fg-muted">
                    {ROLE_DESCRIPTIONS[role]}
                    {allowed ? '' : ' Apenas superadministradores podem alterar.'}
                  </p>
                </div>
              </div>
            );
          })}
        </fieldset>
        {grantsAdminRole ? (
          <Callout tone="warning">
            Papéis administrativos só passam a valer depois que a pessoa ativar a verificação em
            duas etapas.
          </Callout>
        ) : null}
        {selected.length === 0 ? (
          <p role="alert" className="text-[0.8125rem] text-danger">
            A conta precisa de pelo menos um papel.
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <Button
          variant="primary"
          loading={mutation.isPending}
          disabled={unchanged || selected.length === 0}
          onClick={() => mutation.mutate()}
        >
          Salvar papéis
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function StatusDialog({ user, onClose }: UserDialogProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const suspending = user.status === 'ACTIVE';
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateUserStatusInput>({
    resolver: zodResolver(updateUserStatusSchema),
    defaultValues: { status: suspending ? 'SUSPENDED' : 'ACTIVE', reason: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: UpdateUserStatusInput) =>
      api.send<ApiResponse<AdminUserDto>>('PATCH', `/admin/users/${user.id}/status`, values),
    onSuccess: async () => {
      toast.success(
        suspending ? `@${user.username} foi suspenso.` : `@${user.username} foi reativado.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
  });

  return (
    <DialogContent
      title={suspending ? 'Suspender conta' : 'Reativar conta'}
      description={`${user.displayName} · @${user.username}`}
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="contents"
      >
        <DialogBody className="flex flex-col gap-4">
          {mutation.isError ? <Callout tone="danger" title={messageFor(mutation.error)} /> : null}
          {suspending ? (
            <Callout tone="warning">
              A pessoa perde o acesso imediatamente: todas as sessões são encerradas e novos logins
              ficam bloqueados até a reativação.
            </Callout>
          ) : null}
          <FormField
            label="Motivo"
            error={errors.reason?.message}
            hint="Fica registrado na auditoria junto com o seu usuário."
          >
            <Textarea rows={3} autoFocus {...register('reason')} />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button
            type="submit"
            variant={suspending ? 'danger' : 'primary'}
            loading={mutation.isPending}
          >
            {suspending ? 'Suspender conta' : 'Reativar conta'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
