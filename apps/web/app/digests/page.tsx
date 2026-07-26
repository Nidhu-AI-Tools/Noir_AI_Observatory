import { PlaceholderPage } from "../../components/placeholder-page";

export default function DigestsPage() {
  return (
    <PlaceholderPage
      description="Read deterministic daily summaries of releases, models, papers, announcements, and monitored failures."
      emptyDescription="A digest will be generated after each successful collection run once normalized observations are available."
      emptyTitle="No daily digests yet"
      eyebrow="Daily signal"
      title="What changed in AI today"
    />
  );
}
