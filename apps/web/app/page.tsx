import type { Metadata } from "next";

import { TodayDashboard } from "../components/dashboard/today-dashboard";
import { PageHeading } from "../components/page-heading";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <div className="space-y-8">
      <PageHeading
        description="A date-by-date briefing of tracked ecosystem releases, model changes, research, and API health signals."
        eyebrow="Daily AI briefing"
        title="The daily Observatory"
      />

      <TodayDashboard />
    </div>
  );
}
