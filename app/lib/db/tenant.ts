import { prisma } from "./prisma";

export async function getTenantUser(authId: string) {
  return prisma.tenantUser.findFirst({
    where: { authId },
    include: { tenant: true },
  });
}

export async function getOrCreateTenant(authId: string, email: string, opts?: {
  name?: string;
  orgName?: string;
  vertical?: string;
}) {
  const existing = await getTenantUser(authId);
  if (existing) return existing;

  const slug = (opts?.orgName ?? email.split("@")[0])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  // Make slug unique
  const slugBase = slug;
  let finalSlug = slugBase;
  let attempt = 0;
  while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${slugBase}-${++attempt}`;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: opts?.orgName ?? email.split("@")[0],
      slug: finalSlug,
      defaultVertical: opts?.vertical ?? "coffee",
    },
  });

  const tenantUser = await prisma.tenantUser.create({
    data: {
      tenantId: tenant.id,
      authId,
      email,
      name: opts?.name,
      role: "admin",
    },
    include: { tenant: true },
  });

  return tenantUser;
}
