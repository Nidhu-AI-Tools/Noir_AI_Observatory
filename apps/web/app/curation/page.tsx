import type { Metadata } from "next";

import { LegacyTodayRedirect } from "../../components/legacy-today-redirect";

export const metadata: Metadata = {
  title: "Daily Curation moved",
  robots: { index: false, follow: true },
};

export default function CurationPage() {
  return <LegacyTodayRedirect />;
}
