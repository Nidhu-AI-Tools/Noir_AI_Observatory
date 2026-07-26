import type { Metadata } from "next";

import { DigestDashboard } from "../../components/dashboard/digest-dashboard";
import { PageHeading } from "../../components/page-heading";

export const metadata: Metadata = { title: "Daily Digests" };

export default function DigestsPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="Read deterministic daily summaries of releases, models, papers, announcements, and monitored failures."
        eyebrow="Daily signal"
        title="What changed in AI today"
      />
      <DigestDashboard />
    </div>
  );
}
