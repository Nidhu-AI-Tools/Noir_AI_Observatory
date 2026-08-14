import type { Metadata } from "next";

import { LegacyRadarRedirect } from "../../components/legacy-radar-redirect";

export const metadata: Metadata = {
  title: "Sources moved to Radar",
  robots: { index: false, follow: true },
};

export default function SourcesPage() {
  return <LegacyRadarRedirect />;
}
