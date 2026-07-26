import type { Metadata } from "next";

import { ResearchDashboard } from "../../components/dashboard/research-dashboard";
import { PageHeading } from "../../components/page-heading";

export const metadata: Metadata = { title: "Research Watch" };

export default function ResearchPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="Follow new AI papers and official announcements through reviewed arXiv queries and RSS or Atom feeds."
        eyebrow="Research watch"
        title="New work across the AI landscape"
      />
      <ResearchDashboard />
    </div>
  );
}
