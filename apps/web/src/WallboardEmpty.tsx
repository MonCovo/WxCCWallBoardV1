import {
  EmptyState,
  Illustration,
} from "@momentum-design/components/react";
import type IllustrationNames from "@momentum-design/illustrations/dist/types/types";

type EmptySize = "medium" | "large";

export function WallboardEmpty({
  illustration,
  heading,
  description,
  size = "medium",
  className,
}: {
  illustration: IllustrationNames;
  heading: string;
  description?: string;
  size?: EmptySize;
  className?: string;
}) {
  return (
    <div className={["wallboard-empty", className].filter(Boolean).join(" ")}>
      <EmptyState
        layout="vertical"
        size={size}
        heading={heading}
        description={description}
        headingTagName="h3"
      >
        <Illustration slot="illustration" name={illustration} aria-hidden="true" />
      </EmptyState>
    </div>
  );
}
