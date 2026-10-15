-- Geo master data (dr5hn/countries-states-cities-database)

ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "state" TEXT;

CREATE TABLE "GeoCountry" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "iso3" CHAR(3) NOT NULL,
    "phonecode" TEXT,
    "capital" TEXT,
    "currency" TEXT,
    CONSTRAINT "GeoCountry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GeoCountry_iso2_key" ON "GeoCountry"("iso2");
CREATE UNIQUE INDEX "GeoCountry_iso3_key" ON "GeoCountry"("iso3");

CREATE TABLE "GeoState" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "country_id" INTEGER NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "state_code" TEXT,
    CONSTRAINT "GeoState_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeoState_country_id_idx" ON "GeoState"("country_id");
CREATE INDEX "GeoState_country_code_idx" ON "GeoState"("country_code");

CREATE TABLE "GeoCity" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "state_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    CONSTRAINT "GeoCity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeoCity_state_id_idx" ON "GeoCity"("state_id");
CREATE INDEX "GeoCity_country_id_idx" ON "GeoCity"("country_id");
CREATE INDEX "GeoCity_name_idx" ON "GeoCity"("name");

ALTER TABLE "GeoState" ADD CONSTRAINT "GeoState_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "GeoCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeoCity" ADD CONSTRAINT "GeoCity_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "GeoState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeoCity" ADD CONSTRAINT "GeoCity_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "GeoCountry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
