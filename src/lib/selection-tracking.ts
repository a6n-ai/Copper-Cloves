import { logUserSelection } from "@/lib/activity-client";

function isInsideNoActivity(el: Element | null): boolean {
  return !!(el && el.closest("[data-no-activity]"));
}

function controlLabel(el: HTMLElement): string {
  return (
    el.getAttribute("data-activity-label") ||
    el.getAttribute("aria-label") ||
    (el as HTMLInputElement).name ||
    el.id ||
    el.tagName.toLowerCase()
  );
}

let selectionDelegationInstalled = false;

/**
 * Captures native `<select>`, `<input type="radio|checkbox">` changes via delegation.
 * Skips password and hidden inputs. Add `data-no-activity` on a subtree to opt out.
 */
export function installGlobalSelectionTracking() {
  if (typeof document === "undefined" || selectionDelegationInstalled) return;
  selectionDelegationInstalled = true;

  document.addEventListener(
    "change",
    (event) => {
      const raw = event.target;
      if (!(raw instanceof HTMLElement)) return;
      if (isInsideNoActivity(raw)) return;

      if (raw instanceof HTMLSelectElement) {
        const value = raw.multiple
          ? Array.from(raw.selectedOptions)
              .map((o) => o.value)
              .slice(0, 50)
          : raw.value;
        logUserSelection({
          control: "native_select",
          label: controlLabel(raw),
          value,
        });
        return;
      }

      if (raw instanceof HTMLInputElement) {
        const t = raw.type.toLowerCase();
        if (t === "password" || t === "hidden" || t === "file") return;
        if (t === "radio") {
          if (!raw.checked) return;
          logUserSelection({
            control: "native_radio",
            label: controlLabel(raw),
            value: raw.value,
          });
          return;
        }
        if (t === "checkbox") {
          logUserSelection({
            control: "native_checkbox",
            label: controlLabel(raw),
            value: raw.checked,
          });
          return;
        }
        if (t === "range" || t === "color") {
          logUserSelection({
            control: `native_${t}`,
            label: controlLabel(raw),
            value: raw.value,
          });
        }
      }
    },
    true
  );
}
