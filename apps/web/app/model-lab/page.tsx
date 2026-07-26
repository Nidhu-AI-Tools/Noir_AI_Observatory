import type { Metadata } from "next";

import { ModelLabDashboard } from "../../components/dashboard/model-lab-dashboard";
import { PageHeading } from "../../components/page-heading";

export const metadata: Metadata = { title: "Model Consensus Lab" };

export default function ModelLabPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="Compare structured AI ecosystem classifications across providers with reproducible prompts, evidence checks, and gold cases."
        eyebrow="Model consensus lab"
        title="Where models agree—and where they do not"
      />
      <ModelLabDashboard />
    </div>
  );
}
