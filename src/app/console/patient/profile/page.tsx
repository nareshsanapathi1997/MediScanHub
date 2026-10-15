import { redirect } from "next/navigation";

export default function PatientProfileRedirect() {
  redirect("/console/account");
}
