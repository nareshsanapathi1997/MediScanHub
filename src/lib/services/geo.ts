import { prisma } from "@/lib/db";

export async function listGeoCountries() {
  return prisma.geoCountry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, iso2: true, iso3: true } });
}

export async function listGeoStates(countryId: number) {
  return prisma.geoState.findMany({
    where: { countryId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, countryId: true, stateCode: true },
  });
}

export async function searchGeoCities(input: { stateId: number; query?: string; limit?: number }) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const q = input.query?.trim();
  return prisma.geoCity.findMany({
    where: {
      stateId: input.stateId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, stateId: true, countryId: true },
  });
}

export async function resolveGeoLabels(input: { countryId?: number; stateId?: number; cityId?: number }) {
  const [country, state, city] = await Promise.all([
    input.countryId ? prisma.geoCountry.findUnique({ where: { id: input.countryId }, select: { name: true, iso2: true } }) : null,
    input.stateId ? prisma.geoState.findUnique({ where: { id: input.stateId }, select: { name: true } }) : null,
    input.cityId ? prisma.geoCity.findUnique({ where: { id: input.cityId }, select: { name: true } }) : null,
  ]);
  return {
    country: country?.name ?? "",
    state: state?.name ?? "",
    city: city?.name ?? "",
    countryCode: country?.iso2 ?? "",
  };
}
