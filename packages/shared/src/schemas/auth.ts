import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const PRIVACY_NOTICE_VERSION = '2026-09-30';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
  .pipe(z.email('Informe um e-mail válido.'));

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, 'Use de 3 a 20 caracteres: letras minúsculas, números e sublinhado.');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'O nome de exibição deve ter pelo menos 2 caracteres.')
  .max(40, 'O nome de exibição deve ter no máximo 40 caracteres.');

/**
 * Política de senha orientada por comprimento (NIST SP 800-63B): sem regras de composição.
 * O limite superior protege o custo do Argon2id contra entradas abusivas.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);

const opaqueTokenSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{32,128}$/, 'Token inválido.');

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  acceptPrivacyNotice: z.literal(true, 'É necessário aceitar o Aviso de Privacidade.'),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Informe seu e-mail ou nome de usuário.')
    .max(254, 'Identificador muito longo.'),
  password: z.string().min(1, 'Informe sua senha.').max(PASSWORD_MAX_LENGTH, 'Senha muito longa.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({ token: opaqueTokenSchema });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: opaqueTokenSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.').max(PASSWORD_MAX_LENGTH),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'O código deve ter 6 dígitos.');

export const recoveryCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{5}-[a-z0-9]{5}$/, 'Código de recuperação inválido.');

export const mfaConfirmSchema = z.object({ code: totpCodeSchema });
export type MfaConfirmInput = z.infer<typeof mfaConfirmSchema>;

/** Desafio de MFA: aceita o código do aplicativo ou um código de recuperação. */
export const mfaChallengeSchema = z.union([
  z.object({ code: totpCodeSchema }).strict(),
  z.object({ recoveryCode: recoveryCodeSchema }).strict(),
]);
export type MfaChallengeInput = z.infer<typeof mfaChallengeSchema>;

/** Operações sensíveis exigem a senha atual, mesmo com sessão válida. */
export const passwordConfirmationSchema = z.object({
  password: z.string().min(1, 'Informe sua senha.').max(PASSWORD_MAX_LENGTH),
});
export type PasswordConfirmationInput = z.infer<typeof passwordConfirmationSchema>;

export const updateProfileSchema = z.object({ displayName: displayNameSchema });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
