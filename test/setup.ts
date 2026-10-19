import 'reflect-metadata';
import { Logger } from '@nestjs/common';

// Keep test output readable; individual tests spy on Logger methods when they assert on logging.
Logger.overrideLogger(false);
