import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  codeExample = `import { HybridApplication, Router } from 'enginex';

const app = new HybridApplication();
const router = new Router();

router.get('/api/users/:id', async (ctx) => {
  ctx.responseBody = { id: ctx.params.id };
});

app.use(router.routes());
app.listen(3000);`;

  features = [
    {
      icon: '⚡',
      title: 'Blazing Fast',
      description: 'Rust-powered core with Trie-based routing. 15% faster than Koa on average.',
    },
    {
      icon: '🔄',
      title: 'Koa Compatible',
      description: 'Drop-in replacement for Koa. Use your existing middleware and knowledge.',
    },
    {
      icon: '🦀',
      title: 'Rust + TypeScript',
      description: 'Best of both worlds. TypeScript DX with Rust performance via FFI.',
    },
    {
      icon: '🌐',
      title: 'Modern Protocols',
      description: 'HTTP/1.1, HTTP/2, and HTTP/3 (QUIC) support built-in.',
    },
    {
      icon: '🔧',
      title: 'Developer First',
      description: 'Intuitive API, excellent TypeScript types, and comprehensive docs.',
    },
    {
      icon: '📦',
      title: 'Zero Config',
      description: 'Works out of the box with Bun. No complex setup required.',
    },
  ];

  benchmarks = [
    { endpoint: '/json', enginex: 47059, koa: 43897, diff: '+7.2%' },
    { endpoint: '/text', enginex: 46707, koa: 44763, diff: '+4.3%' },
    { endpoint: '/users/:id', enginex: 42643, koa: 30253, diff: '+40.9%' },
  ];
}
