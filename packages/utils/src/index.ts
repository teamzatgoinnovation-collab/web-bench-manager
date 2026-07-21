export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
