import { readFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.migrate" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required (use .env.migrate)");

const prisma = new PrismaClient({ datasources: { db: { url } } });

type CountryRow = { id: number; name: string; iso2: string; iso3: string; phonecode?: string; capital?: string; currency?: string };
type StateRow = { id: number; name: string; country_id: number; country_code: string; iso2?: string | null };
type CityRow = { id: number; name: string; state_id: number; country_id: number; country_code: string };

async function readJson<T>(file: string) {
  const raw = await readFile(path.join(process.cwd(), "scripts", "geo", file), "utf8");
  return JSON.parse(raw) as T;
}

async function chunk<T>(items: T[], size: number, fn: (batch: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

async function main() {
  console.log("Truncating geo tables…");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "GeoCity", "GeoState", "GeoCountry" RESTART IDENTITY CASCADE`);

  const countries = await readJson<CountryRow[]>("countries.json");
  console.log(`Importing ${countries.length} countries…`);
  await prisma.geoCountry.createMany({
    data: countries.map((row) => ({
      id: row.id,
      name: row.name,
      iso2: row.iso2,
      iso3: row.iso3,
      phonecode: row.phonecode ?? null,
      capital: row.capital ?? null,
      currency: row.currency ?? null,
    })),
  });

  const states = await readJson<StateRow[]>("states.json");
  console.log(`Importing ${states.length} states…`);
  await chunk(states, 2000, async (batch) => {
    await prisma.geoState.createMany({
      data: batch.map((row) => ({
        id: row.id,
        name: row.name,
        countryId: row.country_id,
        countryCode: row.country_code,
        stateCode: row.iso2 ?? null,
      })),
    });
  });

  const cities = await readJson<CityRow[]>("cities.json");
  console.log(`Importing ${cities.length} cities (this may take a few minutes)…`);
  let done = 0;
  await chunk(cities, 3000, async (batch) => {
    await prisma.geoCity.createMany({
      data: batch.map((row) => ({
        id: row.id,
        name: row.name,
        stateId: row.state_id,
        countryId: row.country_id,
        countryCode: row.country_code,
      })),
    });
    done += batch.length;
    if (done % 30000 === 0 || done === cities.length) console.log(`  ${done}/${cities.length}`);
  });

  console.log("Geo import complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
