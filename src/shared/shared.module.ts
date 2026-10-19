import { Global, Module } from '@nestjs/common';
import { CLOCK, SystemClock } from './clock.js';
import { ID_GENERATOR, UuidIdGenerator } from './id-generator.js';

/** Cross-cutting technical services needed by every feature module. */
@Global()
@Module({
  providers: [
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidIdGenerator },
  ],
  exports: [CLOCK, ID_GENERATOR],
})
export class SharedModule {}
