import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [, , username, password] = process.argv;

  if (!username || !password) {
    console.error("Usage: npm run user:create -- <username> <password>");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.error(`User "${username}" already exists.`);
    process.exit(1);
  }

  const passwordHash = await hash(password, 10);
  const created = await prisma.user.create({
    data: {
      username,
      passwordHash,
    },
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  });

  console.log("User created:");
  console.log(created);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
