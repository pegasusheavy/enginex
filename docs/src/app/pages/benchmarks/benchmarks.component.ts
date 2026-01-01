import { Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-benchmarks',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './benchmarks.component.html',
  styleUrl: './benchmarks.component.css',
})
export class BenchmarksComponent {
  benchmarks = [
    { endpoint: '/json', enginex: 47059, koa: 43897, diff: 7.2 },
    { endpoint: '/text', enginex: 46707, koa: 44763, diff: 4.3 },
    { endpoint: '/users/:id', enginex: 42643, koa: 30253, diff: 40.9 },
  ];

  averageEngineX = Math.round(
    this.benchmarks.reduce((a, b) => a + b.enginex, 0) / this.benchmarks.length,
  );
  averageKoa = Math.round(this.benchmarks.reduce((a, b) => a + b.koa, 0) / this.benchmarks.length);
  averageDiff = (((this.averageEngineX - this.averageKoa) / this.averageKoa) * 100).toFixed(1);

  getBarWidth(value: number): number {
    const max = Math.max(...this.benchmarks.flatMap((b) => [b.enginex, b.koa]));
    return (value / max) * 100;
  }
}
