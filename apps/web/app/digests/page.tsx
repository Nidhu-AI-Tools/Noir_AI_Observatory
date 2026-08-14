import type { Metadata } from "next";

import { LegacyTodayRedirect } from "../../components/legacy-today-redirect";

export const metadata: Metadata = {
  title: "Daily Digests moved",
  robots: { index: false, follow: true },
};

export default function DigestsPage() {
  return <LegacyTodayRedirect />;
}
