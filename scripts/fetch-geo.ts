import { gunzipSync } from "zlib";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const REPO_JSON =
  "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json";
/** Large city export moved to release assets (no longer in git). */
const CITIES_GZ =
  "https://github.com/dr5hn/countries-states-cities-database/releases/latest/download/json-cities.json.gz";

async function download(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const dir = path.join(process.cwd(), "scripts", "geo");
  await mkdir(dir, { recursive: true });

  for (const file of ["countries.json", "states.json"] as const) {
    process.stdout.write(`Downloading ${file}… `);
    const body = await download(`${REPO_JSON}/${file}`);
    await writeFile(path.join(dir, file), body);
    process.stdout.write(`${(body.length / 1024 / 1024).toFixed(1)} MB\n`);
  }

  process.stdout.write("Downloading cities.json (gzip release)… ");
  const gz = await download(CITIES_GZ);
  const body = gunzipSync(gz);
  await writeFile(path.join(dir, "cities.json"), body);
  process.stdout.write(`${(body.length / 1024 / 1024).toFixed(1)} MB\n`);

  console.log("Saved to scripts/geo/. Run: npm run geo:import");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
