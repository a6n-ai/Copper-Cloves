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

const SKIPPED_INPUT_TYPES = new Set(["password", "hidden", "file"]);

function handleSelectChange(el: HTMLSelectElement) {
  const value = el.multiple
    ? Array.from(el.selectedOptions)
        .map((o) => o.value)
        .slice(0, 50)
    : el.value;
  logUserSelection({
    control: "native_select",
    label: controlLabel(el),
    value,
  });
}

function handleInputChange(el: HTMLInputElement) {
  const t = el.type.toLowerCase();
  if (SKIPPED_INPUT_TYPES.has(t)) return;
  if (t === "radio") {
    if (!el.checked) return;
    logUserSelection({ control: "native_radio", label: controlLabel(el), value: el.value });
    return;
  }
  if (t === "checkbox") {
    logUserSelection({ control: "native_checkbox", label: controlLabel(el), value: el.checked });
    return;
  }
  if (t === "range" || t === "color") {
    logUserSelection({ control: `native_${t}`, label: controlLabel(el), value: el.value });
  }
}

function handleSelectionChange(event: Event) {
  const raw = event.target;
  if (!(raw instanceof HTMLElement)) return;
  if (isInsideNoActivity(raw)) return;
  if (raw instanceof HTMLSelectElement) {
    handleSelectChange(raw);
    return;
  }
  if (raw instanceof HTMLInputElement) {
    handleInputChange(raw);
  }
}

/**
 * Captures native `<select>`, `<input type="radio|checkbox">` changes via delegation.
 * Skips password and hidden inputs. Add `data-no-activity` on a subtree to opt out.
 */
export function installGlobalSelectionTracking() {
  if (typeof document === "undefined" || selectionDelegationInstalled) return;
  selectionDelegationInstalled = true;

  document.addEventListener("change", handleSelectionChange, true);
}
