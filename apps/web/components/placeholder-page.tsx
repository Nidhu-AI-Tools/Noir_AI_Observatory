import { EmptyState } from "./empty-state";
import { PageHeading } from "./page-heading";

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
}

export function PlaceholderPage(props: PlaceholderPageProps) {
  return (
    <div className="space-y-8">
      <PageHeading
        description={props.description}
        eyebrow={props.eyebrow}
        title={props.title}
      />
      <EmptyState
        description={props.emptyDescription}
        title={props.emptyTitle}
      />
    </div>
  );
}
