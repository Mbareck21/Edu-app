import Icon, { type IconName } from "@/components/ui/Icon";
import type { AccentColor } from "@/components/ui/colors";

/** The header of a folded drill card: a big icon tile, the name, one line of what waits inside. */
export default function DrillFoldTitle({
  icon,
  color,
  title,
  line,
}: {
  icon: IconName;
  color: AccentColor;
  title: string;
  line: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: `var(--color-${color})`, color: "#fff" }}
      >
        <Icon name={icon} size={26} />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-xl font-bold">{title}</span>
        <span className="block font-body text-sm font-normal" style={{ color: "var(--color-muted)" }}>
          {line}
        </span>
      </span>
    </span>
  );
}

export { DrillFoldTitle };
