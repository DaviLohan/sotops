import { Global, Inject, Injectable, Module, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../../config/app-config.js';
import { REDIS } from './redis.constants.js';
import { RedisThrottlerStorage } from './redis-throttler.storage.js';

export { REDIS };

@Injectable()
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Redis =>
        new Redis(config.redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true }),
    },
    RedisLifecycle,
    RedisThrottlerStorage,
  ],
  exports: [REDIS, RedisThrottlerStorage],
})
export class RedisModule {}
