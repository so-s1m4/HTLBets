import { Directive, ElementRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';

@Directive({
  selector: 'audio[appMediaStream],video[appMediaStream]',
  standalone: true
})
export class MediaStreamDirective implements OnChanges {
  private readonly elementRef = inject(ElementRef<HTMLMediaElement>);

  @Input() mediaStream: MediaStream | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if ('mediaStream' in changes) {
      const mediaElement = this.elementRef.nativeElement;
      mediaElement.srcObject = this.mediaStream;

      if (this.mediaStream) {
        void mediaElement.play().catch(() => undefined);
      }
    }
  }
}
