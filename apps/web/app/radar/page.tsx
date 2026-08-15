import type { Metadata } from "next";

import { RadarDashboard } from "../../components/dashboard/radar-dashboard";
import { PageHeading } from "../../components/page-heading";

export const metadata: Metadata = { title: "Ecosystem Radar" };

export default function RadarPage() {
  const repositoryUrl =
    process.env.NEXT_PUBLIC_REPOSITORY_URL ??
    "https://github.com/Nidhu-AI-Tools/Noir_AI_Observatory";
  return (
    <div className="space-y-8">
      <PageHeading
        action={
          <a
            className="inline-flex w-fit items-center justify-center rounded-lg bg-violet-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            href={`${repositoryUrl}/issues/new?template=add-source.yml`}
            rel="noreferrer"
            target="_blank"
          >
            Add source
          </a>
        }
        description="Monitor releases and model activity from tracked GitHub repositories and Hugging Face organizations. Configuration changes are reviewed through GitHub."
        eyebrow="Ecosystem radar"
        title="Tracked repositories and model publishers"
      />
      <RadarDashboard />
    </div>
  );
}
