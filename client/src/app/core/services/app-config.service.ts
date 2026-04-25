import { Injectable } from '@angular/core';

import type { AppRuntimeConfig } from '../models/app-config.model';

declare global {
  interface Window {
    __HTLBETS_CONFIG__?: Partial<AppRuntimeConfig>;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  private readonly config = window.__HTLBETS_CONFIG__ || {};

  readonly apiUrl = this.config.apiUrl || '/api';
  readonly socketUrl = this.config.socketUrl || window.location.origin;
}
