import { config } from "dotenv";
import { resetEnvCache } from "@/lib/env";
import { resetDbClients } from "@/lib/db";

config({ path: ".env.test", override: true });
resetEnvCache();
resetDbClients();
