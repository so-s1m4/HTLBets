import { Pipe, type PipeTransform } from '@angular/core';

import type { GameType } from '../../core/models/game.model';
import { gameTypeLabels } from '../../core/models/game.model';

@Pipe({
  name: 'gameLabel',
  standalone: true
})
export class GameLabelPipe implements PipeTransform {
  transform(value: GameType): string {
    return gameTypeLabels[value] || value;
  }
}
