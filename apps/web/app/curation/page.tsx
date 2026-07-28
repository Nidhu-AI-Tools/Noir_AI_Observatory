import type { Metadata } from "next";

import { CurationDashboard } from "../../components/dashboard/curation-dashboard";
import { PageHeading } from "../../components/page-heading";

export const metadata: Metadata = { title: "Daily Curation" };

export default function CurationPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="Human-reviewed daily interpretation of the Observatory's public release, model, research, and API evidence. AI assists the draft; a maintainer approves every published note."
        eyebrow="Daily curation studio"
        title="The signal behind today's AI activity"
      />
      <CurationDashboard />
    </div>
  );
}
