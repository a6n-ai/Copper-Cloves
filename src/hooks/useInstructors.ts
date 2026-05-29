import { mutate } from "swr";
import { useStudioSWR } from "@/lib/swr";

/**
 * Shared SWR key for the instructor roster. Every consumer reads through this
 * one key so a single cached copy is shared app-wide (the roster is small and
 * near-static within a session); writers call `refreshInstructors()` after a
 * create/update/delete to revalidate every mounted reader at once.
 */
export const INSTRUCTORS_KEY = "/api/admin/instructors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useInstructors<T = any[]>() {
  return useStudioSWR<T>(INSTRUCTORS_KEY);
}

export function refreshInstructors() {
  return mutate(INSTRUCTORS_KEY);
}
