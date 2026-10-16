import type { Prisma, ServiceKind, SlotKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "@/domain/actor";
import { assertBranchAccess, assertPermission, hasPermission } from "@/domain/actor";
import { assertCapacity } from "@/lib/services/subscription";

export async function listCenters(city?: string) {
  return prisma.tenant.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      ...(city ? { branches: { some: { city: { contains: city, mode: "insensitive" }, active: true, deletedAt: null } } } : {}),
    },
    include: { branches: { where: { active: true, deletedAt: null }, select: { id: true, name: true, city: true, homeCollection: true } } },
    orderBy: { name: "asc" },
  });
}

/** Price rows in force right now. Public pages must show the same price the server charges at checkout. */
function activePriceWhere(): Prisma.ServicePriceWhereInput {
  const now = new Date();
  return { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] };
}

export async function getCenterBySlug(slug: string) {
  const center = await prisma.tenant.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    include: {
      branches: { where: { active: true, deletedAt: null }, orderBy: { name: "asc" } },
      services: {
        where: { published: true, archivedAt: null },
        include: { category: true, prices: { where: activePriceWhere(), orderBy: { effectiveFrom: "desc" } }, branchLinks: { where: { active: true }, select: { branchId: true } }, parameters: { orderBy: { position: "asc" }, include: { ranges: true } } },
        orderBy: { name: "asc" },
      },
      packages: { where: { published: true, archivedAt: null }, include: { items: { include: { service: true } } }, orderBy: { name: "asc" } },
    },
  });
  if (!center) return null;
  return { ...center, coverImageUrl: center.coverImageUrl ?? null, galleryUrls: center.galleryUrls ?? [] };
}

export async function getCenterByDomain(host: string | null) {
  if (!host) return null;
  const domain = host.split(":")[0]?.toLowerCase();
  if (!domain || domain === "localhost" || domain === "127.0.0.1") return null;
  return prisma.tenant.findFirst({ where: { customDomain: domain, status: "ACTIVE", deletedAt: null } });
}

export async function searchServices(input: { query?: string; city?: string; kind?: ServiceKind }) {
  return prisma.diagnosticService.findMany({
    where: {
      published: true,
      archivedAt: null,
      tenant: { status: "ACTIVE", deletedAt: null },
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.city
        ? { branchLinks: { some: { active: true, branch: { city: { contains: input.city, mode: "insensitive" }, active: true, deletedAt: null } } } }
        : {}),
      ...(input.query
        ? {
            OR: [
              { name: { contains: input.query, mode: "insensitive" } },
              { code: { contains: input.query, mode: "insensitive" } },
              { description: { contains: input.query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      tenant: { select: { name: true, slug: true, city: true, brandColor: true } },
      category: true,
      prices: { where: activePriceWhere(), orderBy: { effectiveFrom: "desc" }, take: 1, include: { branch: { select: { id: true, name: true, city: true } } } },
    },
    orderBy: { name: "asc" },
    take: 80,
  });
}

export async function listPublicPackages() {
  return prisma.testPackage.findMany({
    where: { published: true, archivedAt: null, tenant: { status: "ACTIVE", deletedAt: null } },
    include: { tenant: { select: { name: true, slug: true, city: true, brandColor: true } }, items: { include: { service: true } } },
    orderBy: { name: "asc" },
    take: 40,
  });
}

export async function listSlots(branchId: string, day: string, kind: SlotKind) {
  const start = new Date(`${day}T00:00:00.000+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) throw new DomainError("DATE", "Choose a valid date", 400);
  const slots = await prisma.availabilitySlot.findMany({
    where: { branchId, kind, startsAt: { gte: new Date(), lt: end }, endsAt: { gt: start } },
    orderBy: { startsAt: "asc" },
    include: { equipment: true },
  });
  return slots.filter((slot) => slot.bookedCount < slot.capacity);
}

function tenantScope(actor: Actor) {
  const tenantId = actor.activeTenantId;
  if (!tenantId) throw new DomainError("TENANT_REQUIRED", "Choose a center first", 400);
  return { tenantId, userId: actor.userId, patientId: actor.patientId };
}

export async function listTenantCatalog(actor: Actor) {
  const scope = tenantScope(actor);
  assertPermission(actor, "tenant.read", scope.tenantId);
  return withScope(scope, (tx) =>
    tx.diagnosticService.findMany({
      where: { tenantId: scope.tenantId, archivedAt: null },
      include: { category: true, parameters: { include: { ranges: true }, orderBy: { position: "asc" } }, prices: true, branchLinks: true },
      orderBy: { name: "asc" },
    }),
  );
}

export async function saveService(
  actor: Actor,
  input: {
    id?: string;
    categoryId: string;
    name: string;
    slug: string;
    code: string;
    kind: ServiceKind;
    description: string;
    sampleType?: string;
    preparation?: string;
    tatHours: number;
    modality?: string;
    published: boolean;
    parameters?: Array<{ name: string; unit?: string; resultType: "NUMERIC" | "QUALITATIVE" | "STRUCTURED"; low?: number; high?: number; textValue?: string }>;
  },
) {
  const scope = tenantScope(actor);
  assertPermission(actor, "catalog.manage", scope.tenantId);
  return withScope(scope, async (tx) => {
    const data = {
      tenantId: scope.tenantId,
      categoryId: input.categoryId,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase(),
      code: input.code.trim().toUpperCase(),
      kind: input.kind,
      description: input.description.trim(),
      sampleType: input.sampleType?.trim() || null,
      preparation: input.preparation?.trim() || null,
      tatHours: input.tatHours,
      modality: input.modality?.trim() || null,
      published: input.published,
    };
    const service = input.id
      ? await tx.diagnosticService.update({ where: { id: input.id, tenantId: scope.tenantId }, data })
      : await tx.diagnosticService.create({ data });
    if (input.parameters) {
      await tx.testParameter.deleteMany({ where: { serviceId: service.id, tenantId: scope.tenantId } });
      for (const [index, parameter] of input.parameters.entries()) {
        await tx.testParameter.create({
          data: {
            tenantId: scope.tenantId,
            serviceId: service.id,
            name: parameter.name,
            unit: parameter.unit,
            resultType: parameter.resultType,
            position: index,
            ranges: {
              create: {
                tenantId: scope.tenantId,
                low: parameter.low,
                high: parameter.high,
                textValue: parameter.textValue,
                label: "Default",
              },
            },
          },
        });
      }
    }
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: input.id ? "UPDATE" : "CREATE", entityType: "DiagnosticService", entityId: service.id });
    return service;
  });
}

export async function savePackage(actor: Actor, input: { id?: string; name: string; slug: string; description: string; pricePaise: number; serviceIds: string[]; published: boolean }) {
  const scope = tenantScope(actor);
  assertPermission(actor, "catalog.manage", scope.tenantId);
  if (input.pricePaise < 0) throw new DomainError("PRICE", "Price cannot be negative", 400);
  return withScope(scope, async (tx) => {
    const services = await tx.diagnosticService.findMany({ where: { tenantId: scope.tenantId, id: { in: input.serviceIds }, archivedAt: null } });
    if (services.length !== input.serviceIds.length) throw new DomainError("CATALOG", "One or more tests are not in this center", 400);
    const pkg = input.id
      ? await tx.testPackage.update({
          where: { id: input.id, tenantId: scope.tenantId },
          data: { name: input.name, slug: input.slug, description: input.description, pricePaise: input.pricePaise, published: input.published },
        })
      : await tx.testPackage.create({
          data: { tenantId: scope.tenantId, name: input.name, slug: input.slug, description: input.description, pricePaise: input.pricePaise, published: input.published },
        });
    await tx.packageItem.deleteMany({ where: { packageId: pkg.id } });
    await tx.packageItem.createMany({ data: input.serviceIds.map((serviceId) => ({ packageId: pkg.id, serviceId })) });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "TestPackage", entityId: pkg.id });
    return pkg;
  });
}

export async function setServicePrice(actor: Actor, input: { branchId: string; serviceId: string; pricePaise: number; discountPaise?: number }) {
  const scope = tenantScope(actor);
  assertPermission(actor, "pricing.manage", scope.tenantId);
  assertBranchAccess(actor, scope.tenantId, input.branchId);
  if (input.pricePaise < 0 || (input.discountPaise ?? 0) < 0 || (input.discountPaise ?? 0) > input.pricePaise) {
    throw new DomainError("PRICE", "Discount cannot exceed the price", 400);
  }
  return withScope(scope, async (tx) => {
    await tx.branchService.upsert({
      where: { branchId_serviceId: { branchId: input.branchId, serviceId: input.serviceId } },
      update: { active: true },
      create: { tenantId: scope.tenantId, branchId: input.branchId, serviceId: input.serviceId, active: true },
    });
    const price = await tx.servicePrice.create({
      data: {
        tenantId: scope.tenantId,
        branchId: input.branchId,
        serviceId: input.serviceId,
        pricePaise: input.pricePaise,
        discountPaise: input.discountPaise ?? 0,
      },
    });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "ServicePrice", entityId: price.id });
    return price;
  });
}

export async function createBranch(actor: Actor, input: { name: string; code: string; address: string; city: string; state: string; phone: string; homeCollection: boolean; opensAt: string; closesAt: string }) {
  const scope = tenantScope(actor);
  assertPermission(actor, "branches.manage", scope.tenantId);
  return withScope(scope, async (tx) => {
    await assertCapacity(tx, scope.tenantId, "branch");
    const branch = await tx.branch.create({
      data: { tenantId: scope.tenantId, ...input, code: input.code.toUpperCase(), email: actor.email },
    });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "CREATE", entityType: "Branch", entityId: branch.id });
    return branch;
  });
}

export async function updateBranch(actor: Actor, branchId: string, input: Prisma.BranchUpdateInput) {
  const scope = tenantScope(actor);
  assertPermission(actor, "branches.manage", scope.tenantId);
  assertBranchAccess(actor, scope.tenantId, branchId);
  return withScope(scope, async (tx) => {
    const branch = await tx.branch.update({ where: { id: branchId, tenantId: scope.tenantId }, data: input });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Branch", entityId: branch.id });
    return branch;
  });
}

export async function createSlots(actor: Actor, input: { branchId: string; kind: SlotKind; date: string; times: string[]; capacity: number; equipmentId?: string }) {
  const scope = tenantScope(actor);
  assertPermission(actor, "bookings.manage", scope.tenantId);
  assertBranchAccess(actor, scope.tenantId, input.branchId);
  if (input.capacity < 1 || input.capacity > 50) throw new DomainError("SLOT", "Capacity must be between 1 and 50", 400);
  return withScope(scope, async (tx) => {
    const created = [];
    for (const time of input.times) {
      const startsAt = new Date(`${input.date}T${time}:00+05:30`);
      if (Number.isNaN(startsAt.getTime())) throw new DomainError("DATE", `Invalid time ${time}`, 400);
      const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
      created.push(
        await tx.availabilitySlot.create({
          data: { tenantId: scope.tenantId, branchId: input.branchId, kind: input.kind, startsAt, endsAt, capacity: input.capacity, equipmentId: input.equipmentId },
        }),
      );
    }
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "CREATE", entityType: "AvailabilitySlot", metadata: { count: created.length, branchId: input.branchId } });
    return created;
  });
}

export async function listCategories() {
  return prisma.serviceCategory.findMany({ orderBy: { name: "asc" } });
}

export async function listAccessibleBranches(actor: Actor) {
  const scope = tenantScope(actor);
  const allowed = hasPermission(actor, "tenant.read", scope.tenantId) || hasPermission(actor, "bookings.manage", scope.tenantId) || hasPermission(actor, "imaging.read", scope.tenantId);
  if (!allowed) throw new DomainError("FORBIDDEN", "You do not have permission to do that", 403);
  const branches = await withScope(scope, (tx) => tx.branch.findMany({ where: { tenantId: scope.tenantId, deletedAt: null }, orderBy: { name: "asc" }, include: { equipment: true } }));
  const membership = actor.memberships.find((item) => item.tenantId === scope.tenantId && item.status === "ACTIVE");
  if (!membership || membership.branchScope === "all") return branches;
  return branches.filter((branch) => membership.branchScope.includes(branch.id));
}

export async function listBookableServices(actor: Actor) {
  const scope = tenantScope(actor);
  assertPermission(actor, "bookings.manage", scope.tenantId);
  return withScope(scope, (tx) => tx.diagnosticService.findMany({ where: { tenantId: scope.tenantId, published: true, archivedAt: null }, orderBy: { name: "asc" } }));
}

export async function listBookablePackages(actor: Actor) {
  const scope = tenantScope(actor);
  assertPermission(actor, "bookings.manage", scope.tenantId);
  return withScope(scope, (tx) =>
    tx.testPackage.findMany({ where: { tenantId: scope.tenantId, published: true, archivedAt: null }, orderBy: { name: "asc" } }),
  );
}

export async function compareCenterMetrics(slugs: string[]) {
  const now = new Date();
  const centers = await listCenters();
  const picked = centers.filter((center) => slugs.includes(center.slug)).slice(0, 4);
  return Promise.all(
    picked.map(async (center) => {
      const branchCount = center.branches.length;
      const homeCollectionBranches = center.branches.filter((branch) => branch.homeCollection).length;
      const sample = await prisma.servicePrice.findFirst({
        where: {
          tenantId: center.id,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          service: { published: true, archivedAt: null },
        },
        orderBy: { pricePaise: "asc" },
      });
      const samplePricePaise = sample ? sample.pricePaise - sample.discountPaise : null;
      return { center, branchCount, homeCollectionBranches, samplePricePaise };
    }),
  );
}

export async function tenantBranches(actor: Actor) {
  const scope = tenantScope(actor);
  assertPermission(actor, "tenant.read", scope.tenantId);
  return withScope(scope, (tx) => tx.branch.findMany({ where: { tenantId: scope.tenantId, deletedAt: null }, orderBy: { name: "asc" }, include: { equipment: true } }));
}

function optionalHttpsUrl(value: string | undefined, code: string, label: string) {
  const trimmed = value?.trim() || null;
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  if (!/^https:\/\/[^\s]+$/i.test(trimmed)) throw new DomainError(code, `${label} must be an https URL or site path starting with /`, 400);
  return trimmed;
}

export async function updateTenantProfile(
  actor: Actor,
  input: {
    name: string;
    phone: string;
    about: string;
    address: string;
    city: string;
    brandColor: string;
    accentColor: string;
    logoUrl?: string;
    coverImageUrl?: string;
    galleryUrls?: string;
    customDomain?: string;
  },
) {
  const scope = tenantScope(actor);
  assertPermission(actor, "tenant.manage", scope.tenantId);
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.brandColor) || !/^#[0-9A-Fa-f]{6}$/.test(input.accentColor)) {
    throw new DomainError("COLOR", "Colors must be 6-digit hex values", 400);
  }
  const logoUrl = optionalHttpsUrl(input.logoUrl, "LOGO", "Logo");
  const coverImageUrl = optionalHttpsUrl(input.coverImageUrl, "COVER", "Cover image");
  const galleryUrls = input.galleryUrls
    ? input.galleryUrls
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => optionalHttpsUrl(line, "GALLERY", "Gallery image")!)
    : undefined;
  const customDomain = input.customDomain?.trim().toLowerCase() || null;
  if (customDomain && !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(customDomain)) {
    throw new DomainError("DOMAIN", "Enter a hostname such as book.example.com", 400);
  }
  return withScope(scope, async (tx) => {
    const tenant = await tx.tenant.update({
      where: { id: scope.tenantId },
      data: {
        name: input.name.trim(),
        phone: input.phone.trim(),
        about: input.about.trim(),
        address: input.address.trim(),
        city: input.city.trim(),
        brandColor: input.brandColor,
        accentColor: input.accentColor,
        logoUrl,
        ...(input.coverImageUrl !== undefined ? { coverImageUrl } : {}),
        ...(galleryUrls !== undefined ? { galleryUrls } : {}),
        customDomain,
      },
    });
    await writeAudit(tx, { tenantId: scope.tenantId, actorId: actor.userId, action: "UPDATE", entityType: "Tenant", entityId: tenant.id });
    return tenant;
  });
}

export async function tenantPackages(actor: Actor) {
  const scope = tenantScope(actor);
  assertPermission(actor, "tenant.read", scope.tenantId);
  return withScope(scope, (tx) =>
    tx.testPackage.findMany({ where: { tenantId: scope.tenantId, archivedAt: null }, include: { items: { include: { service: true } } }, orderBy: { name: "asc" } }),
  );
}
