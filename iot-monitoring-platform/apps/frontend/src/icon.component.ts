import { Component, input } from '@angular/core';
const paths: Record<string, string> = {
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  sensor: 'M7 7h10v10H7z M9 1v6m6-6v6M9 17v6m6-6v6M1 9h6m-6 6h6m10-6h6m-6 6h6',
  rule: 'M4 5h16M4 12h16M4 19h16M8 2v6m8 1v6M9 16v6',
  bell: 'M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M9 21h6',
  shield: 'M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M8 12l3 3 5-6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  plus: 'M12 4v16M4 12h16',
  logout: 'M9 4H4v16h5M10 12h11m-5-5 5 5-5 5',
  play: 'M7 3l14 9-14 9z',
  check: 'M5 12l4 4L19 6',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 3a4 4 0 1 1 0 8M22 21v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  thermo: 'M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0 M12 8v10',
  drop: 'M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13z',
  close: 'M6 6l12 12M6 18 18 6',
};
@Component({
  selector: 'p-icon',
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()"/></svg>',
})
export class IconComponent {
  name = input('pulse');
  path() {
    return paths[this.name()] || paths['pulse'];
  }
}
