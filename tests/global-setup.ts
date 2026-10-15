import { execSync } from "child_process";
import { config } from "dotenv";
import path from "path";

export default function setup() {
  const root = process.cwd();
  const parsed = config({ path: path.join(root, ".env.test") }).parsed ?? {};
  const migrateUrl = process.env.DATABASE_URL || parsed.DATABASE_URL || process.env.MIGRATION_DATABASE_URL || parsed.MIGRATION_DATABASE_URL;
  if (!migrateUrl) {
    throw new Error("DATABASE_URL missing in .env.test (database mediscan_test). Run: npm run db:ensure");
  }
  const run = (command: string) => {
    execSync(command, { stdio: "inherit", cwd: root, env: { ...process.env, ...parsed, DATABASE_URL: migrateUrl } });
  };
  run("npx dotenv-cli run -f .env.test -- npx prisma migrate deploy");
  run("npx dotenv-cli run -f .env.test -- npx tsx prisma/seed.ts");
}
