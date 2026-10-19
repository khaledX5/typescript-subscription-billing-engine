import type { IdGenerator } from '../../src/shared/id-generator.js';

/** Produces predictable IDs (`sub_1`, `sub_2`, `inv_1`, ...) with an independent counter per prefix. */
export class SequentialIdGenerator implements IdGenerator {
  private readonly counters = new Map<string, number>();

  generate(prefix: string): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}_${next}`;
  }
}
