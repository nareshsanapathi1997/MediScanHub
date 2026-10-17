import { cache } from "react";
import type { Prisma, ServiceKind, SlotKind } from "@prisma/client";
import { prisma, prismaPrivileged } from "@/lib/db";
import { withScope } from "@/lib/scope";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "@/domain/actor";
import { assertBranchAccess, assertPermission, hasPermission } from "@/domain/actor";
import { assertCapacity } from "@/lib/services/subscription";

function centerWhere(city?: string): Prisma.TenantWhereInput {
  return {
    status: "ACTIVE",
    deletedAt: null,
    ...(city ? { branches: { some: { city: { contains: city, mode: "insensitive" }, active: true, deletedAt: null } } } : {}),
  };
}
const centerInclude = { branches: { where: { active: true, deletedAt: null }, select: { id: true, name: true, city: true, homeCollection: true } } } satisfies Prisma.TenantInclude;

/** Public center cards — React.cache dedupes within a single RSC request. */
export const listCenters = cache(async (city?: string) => {
  return prisma.tenant.findMany({
    where: centerWhere(city),
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      brandColor: true,
      logoUrl: true,
      coverImageUrl: true,
      branches: centerInclude.branches,
    },
    orderBy: { name: "asc" },
  });
});

/** One page of active centers plus the total. */
export async function listCentersPage(city: string | undefined, paging: { skip: number; take: number }) {
  const where = centerWhere(city);
  const [items, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        brandColor: true,
        logoUrl: true,
        coverImageUrl: true,
        branches: centerInclude.branches,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: paging.skip,
      take: paging.take,
    }),
    prisma.tenant.count({ where }),
  ]);
  return { items, total };
}

/** Active branches that offer home collection, one page at a time. */
export async function listHomeCollectionBranchesPage(paging: { skip: number; take: number }) {
  const where: Prisma.BranchWhereInput = { homeCollection: true, active: true, deletedAt: null, tenant: { status: "ACTIVE", deletedAt: null } };
  const [items, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      select: { id: true, name: true, city: true, tenant: { select: { name: true, slug: true } } },
      orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
      skip: paging.skip,
      take: paging.take,
    }),
    prisma.branch.count({ where }),
  ]);
  return { items, total };
}

/** Price rows in force right now. Public pages must show the same price the server charges at checkout. */
function activePriceWhere(): Prisma.ServicePriceWhereInput {
  const now = new Date();
  return { effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] };
}

const profileBranchSelect = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  phone: true,
  email: true,
  opensAt: true,
  closesAt: true,
  weeklyHours: true,
  holidays: true,
  homeCollection: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.BranchSelect;

const profileServiceSelect = {
  id: true,
  name: true,
  description: true,
  kind: true,
  modality: true,
  sampleType: true,
  preparation: true,
  tatHours: true,
  category: { select: { id: true, name: true, description: true } },
  prices: {
    where: activePriceWhere(),
    orderBy: { effectiveFrom: "desc" as const },
    select: { id: true, branchId: true, pricePaise: true, discountPaise: true, effectiveFrom: true },
  },
} satisfies Prisma.DiagnosticServiceSelect;

const profilePackageServiceSelect = {
  id: true,
  name: true,
  kind: true,
  modality: true,
  preparation: true,
} satisfies Prisma.DiagnosticServiceSelect;

export async function getCenterBySlug(slug: string) {
  const center = await prisma.tenant.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      legalName: true,
      gstin: true,
      email: true,
      phone: true,
      city: true,
      state: true,
      address: true,
      about: true,
      brandColor: true,
      accentColor: true,
      logoUrl: true,
      coverImageUrl: true,
      galleryUrls: true,
      branches: { where: { active: true, deletedAt: null }, orderBy: { name: "asc" }, select: profileBranchSelect },
      services: {
        where: { published: true, archivedAt: null },
        orderBy: { name: "asc" },
        select: profileServiceSelect,
      },
      packages: {
        where: { published: true, archivedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          pricePaise: true,
          items: { select: { id: true, serviceId: true, service: { select: profilePackageServiceSelect } } },
        },
      },
    },
  });
  if (!center) return null;
  // Verification documents are private; the public page only learns whether one was approved.
  const approved = await prismaPrivileged.centerVerification.findFirst({ where: { tenantId: center.id, status: "APPROVED" }, orderBy: { reviewedAt: "desc" }, select: { reviewedAt: true } });
  return { ...center, verifiedAt: approved ? (approved.reviewedAt ?? new Date(0)) : null, coverImageUrl: center.coverImageUrl ?? null, galleryUrls: center.galleryUrls ?? [] };
}

export const getCenterByDomain = cache(async (host: string | null) => {
  if (!host) return null;
  const domain = host.split(":")[0]?.toLowerCase();
  if (!domain || domain === "localhost" || domain === "127.0.0.1") return null;
  return prisma.tenant.findFirst({
    where: { customDomain: domain, status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, slug: true, brandColor: true },
  });
});

type ServiceSearch = { query?: string; city?: string; kind?: ServiceKind; modality?: string };

function serviceWhere(input: ServiceSearch): Prisma.DiagnosticServiceWhereInput {
  return {
    published: true,
    archivedAt: null,
    tenant: { status: "ACTIVE", deletedAt: null },
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.modality ? { modality: input.modality as Prisma.DiagnosticServiceWhereInput["modality"] } : {}),
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
  };
}

function serviceInclude() {
  return {
    tenant: { select: { name: true, slug: true, city: true, brandColor: true } },
    category: { select: { id: true, name: true } },
    prices: {
      where: activePriceWhere(),
      orderBy: { effectiveFrom: "desc" as const },
      take: 1,
      select: { pricePaise: true, discountPaise: true, branch: { select: { id: true, name: true, city: true } } },
    },
  } satisfies Prisma.DiagnosticServiceInclude;
}

/** A short list of services (home page teasers). Listing pages use searchServicesPage. */
export const searchServices = cache(async (input: ServiceSearch, limit = 12) => {
  return prisma.diagnosticService.findMany({
    where: serviceWhere(input),
    select: {
      id: true,
      name: true,
      description: true,
      kind: true,
      modality: true,
      tatHours: true,
      sampleType: true,
      preparation: true,
      tenant: serviceInclude().tenant,
      category: serviceInclude().category,
      prices: serviceInclude().prices,
    },
    orderBy: { name: "asc" },
    take: limit,
  });
});

/** One page of published services plus the total, for server-side pagination. */
export async function searchServicesPage(input: ServiceSearch, paging: { skip: number; take: number }) {
  const where = serviceWhere(input);
  const include = serviceInclude();
  const [items, total] = await Promise.all([
    prisma.diagnosticService.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        kind: true,
        modality: true,
        tatHours: true,
        sampleType: true,
        preparation: true,
        tenant: include.tenant,
        category: include.category,
        prices: include.prices,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: paging.skip,
      take: paging.take,
    }),
    prisma.diagnosticService.count({ where }),
  ]);
  return { items, total };
}

/** Scan modalities that have at least one bookable study (for the filter chips). */
export async function listScanModalities() {
  const rows = await prisma.diagnosticService.findMany({ where: serviceWhere({ kind: "IMAGING" }), select: { modality: true }, distinct: ["modality"] });
  return rows.map((row) => row.modality).filter((value): value is NonNullable<typeof value> => value != null);
}

const packageWhere: Prisma.TestPackageWhereInput = { published: true, archivedAt: null, tenant: { status: "ACTIVE", deletedAt: null } };
const packageSelect = {
  id: true,
  name: true,
  description: true,
  pricePaise: true,
  tenant: { select: { name: true, slug: true, city: true, brandColor: true } },
  items: { select: { serviceId: true, service: { select: { name: true } } } },
} satisfies Prisma.TestPackageSelect;

export const listPublicPackages = cache(async (limit = 12) => {
  return prisma.testPackage.findMany({ where: packageWhere, select: packageSelect, orderBy: { name: "asc" }, take: limit });
});

export async function listPublicPackagesPage(paging: { skip: number; take: number }) {
  const [items, total] = await Promise.all([
    prisma.testPackage.findMany({ where: packageWhere, select: packageSelect, orderBy: [{ name: "asc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
    prisma.testPackage.count({ where: packageWhere }),
  ]);
  return { items, total };
}

export async function listSlots(branchId: string, day: string, kind: SlotKind) {
  const start = new Date(`${day}T00:00:00.000+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) throw new DomainError("DATE", "Choose a valid date", 400);
  const slots = await prisma.availabilitySlot.findMany({
    where: { branchId, kind, startsAt: { gte: new Date(), lt: end }, endsAt: { gt: start } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      branchId: true,
      kind: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      bookedCount: true,
      equipmentId: true,
    },
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

export async function createBranch(actor: Actor, input: { name: string; code: string; address: string; city: string; state: string; phone: string; homeCollection: boolean; opensAt: string; closesAt: string; weeklyHours?: Prisma.InputJsonValue; holidays?: string[] }) {
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
  if (input.kind === "IMAGING") throw new DomainError("SLOT", "Scan slots belong to a machine. Add them from Scan rooms.", 400);
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
  const unique = [...new Set(slugs)].slice(0, 4);
  if (unique.length === 0) return [];
  const now = new Date();
  const centers = await prisma.tenant.findMany({
    where: { slug: { in: unique }, status: "ACTIVE", deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      brandColor: true,
      logoUrl: true,
      coverImageUrl: true,
      branches: centerInclude.branches,
    },
    orderBy: { name: "asc" },
  });
  const samples = await prisma.servicePrice.findMany({
    where: {
      tenantId: { in: centers.map((center) => center.id) },
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      service: { published: true, archivedAt: null },
    },
    orderBy: { pricePaise: "asc" },
    select: { tenantId: true, pricePaise: true, discountPaise: true },
  });
  const lowestByTenant = new Map<string, number>();
  for (const sample of samples) {
    if (lowestByTenant.has(sample.tenantId)) continue;
    lowestByTenant.set(sample.tenantId, sample.pricePaise - sample.discountPaise);
  }
  const bySlug = new Map(centers.map((center) => [center.slug, center]));
  return unique
    .map((slug) => bySlug.get(slug))
    .filter((center): center is NonNullable<typeof center> => Boolean(center))
    .map((center) => ({
      center,
      branchCount: center.branches.length,
      homeCollectionBranches: center.branches.filter((branch) => branch.homeCollection).length,
      samplePricePaise: lowestByTenant.get(center.id) ?? null,
    }));
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

export async function tenantPackagesPage(actor: Actor, paging: { skip: number; take: number }) {
  const scope = tenantScope(actor);
  assertPermission(actor, "tenant.read", scope.tenantId);
  const where = { tenantId: scope.tenantId, archivedAt: null };
  return withScope(scope, async (tx) => {
    const [items, total] = await Promise.all([
      tx.testPackage.findMany({ where, include: { items: { include: { service: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: paging.skip, take: paging.take }),
      tx.testPackage.count({ where }),
    ]);
    return { items, total };
  });
}
