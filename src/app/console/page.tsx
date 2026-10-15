import { redirect } from "next/navigation";
import { homeFor } from "@/domain/actor";
import { requireSession } from "@/server/session";

export default async function ConsoleHome() {
  const session = await requireSession();
  redirect(homeFor(session.actor));
}
