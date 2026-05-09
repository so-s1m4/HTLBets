import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import type { CardDeck, CardDeckMutationResponse } from '../models/user.model';
import { AppConfigService } from './app-config.service';

@Injectable({
  providedIn: 'root'
})
export class CardDeckService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  listMine(): Promise<CardDeck[]> {
    return firstValueFrom(this.http.get<CardDeck[]>(`${this.config.apiUrl}/me/card-decks`));
  }

  purchase(deckId: string): Promise<CardDeckMutationResponse> {
    return firstValueFrom(this.http.post<CardDeckMutationResponse>(`${this.config.apiUrl}/me/card-decks/${deckId}/purchase`, {}));
  }

  select(deckId: string): Promise<CardDeckMutationResponse> {
    return firstValueFrom(this.http.post<CardDeckMutationResponse>(`${this.config.apiUrl}/me/card-decks/${deckId}/select`, {}));
  }
}
