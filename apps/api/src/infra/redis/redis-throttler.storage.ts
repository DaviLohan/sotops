import { Inject, Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { REDIS } from './redis.constants.js';

interface ThrottlerRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Janela fixa atômica: incrementa o contador, define a expiração na primeira ocorrência e,
 * ao ultrapassar o limite, cria uma chave de bloqueio. Um único script evita condições de corrida
 * entre instâncias da API.
 */
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl <= 0 and hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blockTtl = tonumber(ARGV[3])
end
return { hits, ttl, blockTtl }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerRecord> {
    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${hitKey}:blocked`;
    const [hits, hitTtl, blockTtl] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      hitKey,
      blockKey,
      ttl,
      limit,
      blockDuration > 0 ? blockDuration : ttl,
    )) as [number, number, number];

    return {
      totalHits: hits,
      timeToExpire: Math.max(0, Math.ceil(hitTtl / 1000)),
      isBlocked: blockTtl > 0,
      timeToBlockExpire: Math.max(0, Math.ceil(blockTtl / 1000)),
    };
  }
}
