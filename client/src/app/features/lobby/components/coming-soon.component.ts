import { Component } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [AppCardComponent],
  templateUrl: './coming-soon.component.html',
  styleUrl: './coming-soon.component.scss'
})
export class ComingSoonComponent {}
