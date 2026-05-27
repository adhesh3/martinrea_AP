import { Global, Module } from '@nestjs/common';

import { MockEpicorController } from './mock-epicor.controller';
import { MockEpicorService } from './mock-epicor.service';

/**
 * Mock Epicor CMS module — simulates Martinrea's 44 plant Epicor instances
 * for demo and testing.
 *
 * Marked `@Global()` so `IntegrationsModule` (and its descendants) can
 * inject `MockEpicorService` without explicitly importing this module —
 * this lets `AppModule` conditionally load it only outside production
 * while keeping the integration services' provider chain unchanged.
 *
 * Drop the entire `src/mock-epicor/` folder once real Epicor credentials
 * and a `RealEpicorService` adapter are wired in.
 */
@Global()
@Module({
  controllers: [MockEpicorController],
  providers: [MockEpicorService],
  exports: [MockEpicorService],
})
export class MockEpicorModule {}
