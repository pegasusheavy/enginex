import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'docs',
    loadComponent: () => import('./pages/docs/docs.component').then((m) => m.DocsComponent),
  },
  {
    path: 'api',
    loadComponent: () => import('./pages/api/api.component').then((m) => m.ApiComponent),
  },
  {
    path: 'benchmarks',
    loadComponent: () =>
      import('./pages/benchmarks/benchmarks.component').then((m) => m.BenchmarksComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
