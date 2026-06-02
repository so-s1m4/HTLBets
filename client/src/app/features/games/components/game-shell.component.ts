import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, signal } from '@angular/core';

import { AppCardComponent } from '../../../shared/ui/app-card.component';

@Component({
  selector: 'app-game-shell',
  standalone: true,
  imports: [AppCardComponent],
  templateUrl: './game-shell.component.html',
  styleUrl: './game-shell.component.scss'
})
export class GameShellComponent {
  @ViewChild('shellRoot') private readonly shellRoot?: ElementRef<HTMLElement>;

  @Input() title = '';
  @Input() subtitle = '';
  @Input() connectionState = 'disconnected';
  @Input() currentBet = 0;
  @Input() error = '';
  @Input() hasSidebar = true;
  @Input() splitSidebar = true;
  @Output() fullscreenChange = new EventEmitter<boolean>();

  readonly isFullscreen = signal(false);

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.setFullscreen(document.fullscreenElement === this.shellRoot?.nativeElement);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!document.fullscreenElement && this.isFullscreen()) {
      this.setFullscreen(false);
    }
  }

  async toggleFullscreen(): Promise<void> {
    const shell = this.shellRoot?.nativeElement;

    if (!shell) {
      return;
    }

    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
      return;
    }

    if (this.isFullscreen()) {
      this.setFullscreen(false);
      return;
    }

    if (document.fullscreenEnabled) {
      try {
        await shell.requestFullscreen();
        return;
      } catch {
        this.setFullscreen(true);
        return;
      }
    }

    this.setFullscreen(true);
  }

  private setFullscreen(value: boolean): void {
    if (this.isFullscreen() === value) {
      return;
    }

    this.isFullscreen.set(value);
    this.fullscreenChange.emit(value);
  }
}
