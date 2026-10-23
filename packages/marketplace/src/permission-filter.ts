/** The choices of the Permission filter: the select's value, its label and the Permissions the User then accepts (undefined: all). */
export const PERMISSION_FILTERS: ReadonlyArray<{ value: string; label: string; accepts: readonly string[] | undefined }> = [
  { value: "any", label: "Any Permissions", accepts: undefined },
  { value: "no-internet", label: "No internet access", accepts: ["localNetwork"] },
  { value: "no-local-network", label: "No local network access", accepts: ["network"] },
  { value: "none", label: "No Permissions", accepts: [] },
];

/** The `accepts` option of searchModules for a value of the Permission filter; an unknown value accepts everything. */
export function permissionFilter(value: string): readonly string[] | undefined {
  return PERMISSION_FILTERS.find((filter) => filter.value === value)?.accepts;
}
