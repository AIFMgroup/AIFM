import { redirect } from "next/navigation";

export const revalidate = 0;

export default async function HomePage() {
  // Redirect to overview page
  redirect("/overview");
}