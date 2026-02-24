import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_REFRESH_COOKIE } from "@/lib/auth/constants";

export default async function Home() {
  const token = (await cookies()).get(AUTH_REFRESH_COOKIE)?.value;
  if (!token) {
    redirect("/login");
  }

  redirect("/strategy");
}
