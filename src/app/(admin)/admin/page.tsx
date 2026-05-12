import { redirect } from "next/navigation";

export default function AdminHomeRedirectPage() {
  redirect("/dashboard");
}
