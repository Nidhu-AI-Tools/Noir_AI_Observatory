import type { Metadata } from "next";

import { HealthDashboard } from "../../components/dashboard/health-dashboard";
import { PageHeading } from "../../components/page-heading";

export const metadata: Metadata = { title: "API Health" };

export default function HealthPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="Inspect observed availability, latency, recent failures, and eventually model-specific API behavior."
        eyebrow="API health"
        title="Operational signals from tracked APIs"
      />
      <HealthDashboard />
    </div>
  );
}
