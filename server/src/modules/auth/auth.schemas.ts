import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome (mínimo de 2 caracteres)").max(120),
  email: z.email("Informe um e-mail válido").trim().toLowerCase().max(255),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(72), // limite do bcrypt
});

export const loginSchema = z.object({
  email: z.email("Informe um e-mail válido").trim().toLowerCase(),
  password: z.string().min(1, "Informe sua senha"),
});

export const statusPageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])$/, "Use 3–64 caracteres: letras minúsculas, números e hífens");

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome (mínimo de 2 caracteres)").max(120),
    statusPageSlug: statusPageSlugSchema.nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, "Envie ao menos um campo para atualizar");

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
