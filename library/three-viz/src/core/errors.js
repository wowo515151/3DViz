/** Error type shared by the Three.js visualization backend. */
export class VisualizationError extends Error {
  constructor(code, message, { details, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "VisualizationError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function fail(code, message, details) {
  throw new VisualizationError(code, message, { details });
}

export function assert(condition, code, message, details) {
  if (!condition) fail(code, message, details);
}
