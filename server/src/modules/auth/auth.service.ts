import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { conflict, notFound, unauthorized } from "../../lib/errors.js";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "./auth.schemas.js";

const BCRYPT_ROUNDS = 12;
// Comparado quando o e-mail não existe, para o tempo de resposta não revelar se a conta existe.
const DUMMY_HASH = bcrypt.hashSync("timing-attack-mitigation", BCRYPT_ROUNDS);

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  statusPageSlug: true,
  createdAt: true,
} as const;

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict("E-mail já cadastrado");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  return prisma.user.create({
    data: { name: input.name, email: input.email, passwordHash },
    select: publicUserSelect,
  });
}

export async function authenticateUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw unauthorized("E-mail ou senha inválidos");

  const { passwordHash: _, ...publicUser } = user;
  return publicUser;
}

export async function updateProfile(id: string, input: UpdateProfileInput) {
  if (input.statusPageSlug) {
    const taken = await prisma.user.findFirst({
      where: { statusPageSlug: input.statusPageSlug, NOT: { id } },
      select: { id: true },
    });
    if (taken) throw conflict("Este endereço de página de status já está em uso");
  }
  return prisma.user.update({ where: { id }, data: input, select: publicUserSelect });
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user) throw notFound("Usuário não encontrado");
  return user;
}
