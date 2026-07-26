import { PROJECT_NAME } from "@noir/core";

import { ActivitySummary } from "../components/activity-summary";
import { PageHeading } from "../components/page-heading";

export default function OverviewPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="A continuously updated view of AI models, developer tools, research, releases, and the APIs that power them."
        eyebrow="AI ecosystem intelligence"
        title={PROJECT_NAME}
        action={
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Collection ready
          </span>
        }
      />

      <ActivitySummary />
    </div>
  );
}
