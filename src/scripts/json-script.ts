// JSON for inside <script type="application/json">: "<" can never end the block, and the characters some parsers
// and HTML treat as special are written as \u escapes. JSON.parse reads it back to the same value.
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
