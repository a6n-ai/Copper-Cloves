import { memo } from "react";

interface VariablePaletteProps {
  /** Fixed, code-owned palette for the selected template. */
  variables: readonly string[];
  /** Insert `{{Var}}` at the body cursor. */
  onInsert: (variable: string) => void;
  /** Optional copy override for the label. */
  label?: string;
}

/**
 * Fixed variable palette — chips the admin clicks to insert a `{{Token}}` at the
 * textarea cursor. The palette is code-owned (the template's declared variables),
 * so admins can only insert tokens the builder always fills.
 */
function VariablePaletteBase({ variables, onInsert, label }: VariablePaletteProps) {
  if (!variables.length) return null;
  return (
    <div>
      <p className="font-body text-xs text-charcoal/50 mb-2">
        {label ?? "Variables — click to insert at cursor"}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {variables.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onInsert(v)}
            title={`Insert {{${v}}}`}
            className="inline-flex items-center rounded-md bg-sage/10 px-2 py-1 font-mono text-xs text-sage transition-[background-color,transform] duration-150 ease-out hover:bg-sage/20 active:scale-[0.96] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-1"
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}

export const VariablePalette = memo(VariablePaletteBase);
