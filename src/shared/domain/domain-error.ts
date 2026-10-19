/**
 * Semantic category of a business-rule violation. The domain only says *what kind* of
 * problem occurred; the presentation layer decides how that maps to a transport (HTTP).
 */
export type DomainErrorCategory = 'INVALID' | 'NOT_FOUND' | 'CONFLICT';

/**
 * Base class for every expected, business-level failure. Anything that is not a
 * DomainError is treated as an unexpected fault.
 */
export abstract class DomainError extends Error {
  /** Stable, machine-readable identifier exposed to API clients. */
  abstract readonly code: string;
  abstract readonly category: DomainErrorCategory;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
