import { setRequestLocale } from "next-intl/server";
import { MarketTableClient } from "@/components/market/market-table-client";
import { redirect } from "@/i18n/navigation";
import { getAuthenticatedUserFromServerCookies } from "@/server/auth/auth.service";
import { getAccessState } from "@/server/access/access.service";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getAuthenticatedUserFromServerCookies();
  if (!user) {
    return redirect({ href: "/login", locale });
  }

  const access = await getAccessState(user.id, user.email);
  if (!access.approved) {
    return redirect({ href: "/waiting-access", locale });
  }

  return <MarketTableClient />;
}
