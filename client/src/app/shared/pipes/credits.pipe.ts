import { Pipe, type PipeTransform } from '@angular/core';

@Pipe({
  name: 'credits',
  standalone: true
})
export class CreditsPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return `${Intl.NumberFormat('en-US').format(value || 0)}`;
  }
}
