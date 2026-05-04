import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomNavigationComponent } from '../bottom-navigation/bottom-navigation.component';
import { TopBarComponent } from '../top-bar/top-bar.component';

@Component({
  selector: 'app-mobile-shell',
  standalone: true,
  imports: [RouterOutlet, TopBarComponent, BottomNavigationComponent],
  templateUrl: './mobile-shell.component.html',
  styleUrl: './mobile-shell.component.scss'
})
export class MobileShellComponent {}
