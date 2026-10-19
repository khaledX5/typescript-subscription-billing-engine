import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** Produces unique, prefixed identifiers such as `sub_3f1c...`. Injected so tests are deterministic. */
export interface IdGenerator {
  generate(prefix: string): string;
}

export const ID_GENERATOR = Symbol('IdGenerator');

@Injectable()
export class UuidIdGenerator implements IdGenerator {
  generate(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
  }
}
