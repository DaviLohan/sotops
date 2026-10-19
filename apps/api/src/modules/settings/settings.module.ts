import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service.js';

/** Global: o portal, os e-mails e o painel leem as mesmas configurações. */
@Global()
@Module({ providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
