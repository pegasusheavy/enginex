import { Component } from '@angular/core';

@Component({
  selector: 'app-docs',
  standalone: true,
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.css',
})
export class DocsComponent {
  sections = [
    { id: 'installation', title: 'Installation' },
    { id: 'quick-start', title: 'Quick Start' },
    { id: 'middleware', title: 'Middleware' },
    { id: 'routing', title: 'Routing' },
    { id: 'context', title: 'Context' },
  ];

  activeSection = 'installation';

  scrollTo(sectionId: string) {
    this.activeSection = sectionId;
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
  }
}
