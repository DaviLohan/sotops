import { Global, Module } from '@nestjs/common';
import { AppConfig } from './app-config.js';
import { parseEnv } from './env.js';
import { loadEnvFiles } from './load-env-files.js';

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useFactory: (): AppConfig => {
        loadEnvFiles();
        return new AppConfig(parseEnv(process.env));
      },
    },
  ],
  exports: [AppConfig],
})
export class ConfigModule {}
