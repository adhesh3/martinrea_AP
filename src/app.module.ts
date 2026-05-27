import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { IntegrationsModule } from './integrations/integrations.module';
import { MockEpicorModule } from './mock-epicor/mock-epicor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        database: configService.get<string>('DB_NAME'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // Single source of truth for column naming: entities keep camelCase
        // property names; this strategy converts them to snake_case at the
        // SQL boundary so the migrations Roshni reviews stay Postgres-idiomatic.
        // Required for any DB-touching code to work end-to-end against the
        // V1–V5 migration schema.
        namingStrategy: new SnakeNamingStrategy(),
        // NEVER true in prod — we let migrations own the schema there.
        // In dev we let TypeORM auto-create tables so the verify steps
        // run without manual DDL.
        synchronize:
          configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    ScheduleModule.forRoot(),
    // MockEpicor is loaded only outside production — guarantees no mock data
    // ever reaches a real environment, even if someone forgets to disable an
    // import. Production deployments must wire real Epicor adapters before
    // booting; the DI container will fail loud at startup if not, which is
    // the desired defensive behaviour.
    ...(process.env.NODE_ENV !== 'production' ? [MockEpicorModule] : []),
    IntegrationsModule,
  ],
})
export class AppModule {}
