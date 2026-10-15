import { cache } from "react";
import { getCenterBySlug } from "./catalog";

export const loadCenterProfile = cache(getCenterBySlug);
