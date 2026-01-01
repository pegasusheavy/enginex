import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  navLinks = [
    { path: '/', label: 'Home', exact: true },
    { path: '/docs', label: 'Docs' },
    { path: '/api', label: 'API' },
    { path: '/benchmarks', label: 'Benchmarks' },
  ];

  mobileMenuOpen = false;

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }
}
