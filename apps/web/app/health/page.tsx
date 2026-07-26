import { PlaceholderPage } from "../../components/placeholder-page";

export default function HealthPage() {
  return (
    <PlaceholderPage
      description="Inspect observed availability, latency, recent failures, and eventually model-specific API behavior."
      emptyDescription="Endpoint definitions and scheduled health observations will be introduced after the release collection pipeline."
      emptyTitle="No API monitors configured"
      eyebrow="API health"
      title="Operational signals from tracked APIs"
    />
  );
}
