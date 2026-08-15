import type { Metadata } from "next";

import { ModelRadarDashboard } from "../../components/dashboard/model-radar-dashboard";
import { PageHeading } from "../../components/page-heading";

export const metadata: Metadata = { title: "Model Radar" };
export default function ModelsPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="Follow confirmed releases, first observations, revisions, and lifecycle changes through public model signals."
        eyebrow="Model intelligence"
        title="The latest models across every category"
      />
      <ModelRadarDashboard />
    </div>
  );
}
