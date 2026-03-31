import { redirect } from "next/navigation";
import { MarketTableClient } from "@/components/market/market-table-client";
import { getAuthenticatedUserFromServerCookies } from "@/server/auth/auth.service";
import { getAccessState } from "@/server/access/access.service";

export default async function Home() {
  const user = await getAuthenticatedUserFromServerCookies();
  if (!user) {
    redirect("/login");
  }

  const access = await getAccessState(user.id, user.email);
  if (!access.approved) {
    redirect("/waiting-access");
  }

  return <MarketTableClient />;
}
