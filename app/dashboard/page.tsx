import { cookies } from "next/headers";
import DashboardClient from "../components/dashboard-client";

async function getConnectedEmail() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("gmail_provider_token")?.value;

    if (!accessToken) {
      return null;
    }

    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.email || null;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const connectedEmail = await getConnectedEmail();

  return (
    <DashboardClient email={connectedEmail || "Not connected"} />
  );
}