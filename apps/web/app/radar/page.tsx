import type { Metadata } from "next";

import { RadarDashboard } from "../../components/dashboard/radar-dashboard";
import { PageHeading } from "../../components/page-heading";

export const metadata: Metadata = { title: "Ecosystem Radar" };

export default function RadarPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="Browse tracked AI models, tools, databases, and infrastructure by category, tag, and recent activity."
        eyebrow="Ecosystem radar"
        title="Models, tools, and infrastructure"
      />
      <RadarDashboard />
    </div>
  );
}
