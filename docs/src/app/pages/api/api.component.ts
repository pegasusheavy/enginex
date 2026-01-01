import { Component } from '@angular/core';

@Component({
  selector: 'app-api',
  standalone: true,
  templateUrl: './api.component.html',
  styleUrl: './api.component.css',
})
export class ApiComponent {
  apiSections = [
    {
      title: 'HybridApplication',
      methods: [
        { name: 'use(middleware)', desc: 'Register a middleware function', returns: 'this' },
        { name: 'listen(port, callback?)', desc: 'Start the HTTP server', returns: 'this' },
        { name: 'close()', desc: 'Stop the HTTP server', returns: 'Promise<void>' },
      ],
    },
    {
      title: 'Router',
      methods: [
        { name: 'get(path, handler)', desc: 'Register GET route', returns: 'this' },
        { name: 'post(path, handler)', desc: 'Register POST route', returns: 'this' },
        { name: 'put(path, handler)', desc: 'Register PUT route', returns: 'this' },
        { name: 'delete(path, handler)', desc: 'Register DELETE route', returns: 'this' },
        { name: 'patch(path, handler)', desc: 'Register PATCH route', returns: 'this' },
        { name: 'all(path, handler)', desc: 'Register route for all methods', returns: 'this' },
        { name: 'group(prefix, setup)', desc: 'Create route group with prefix', returns: 'this' },
        { name: 'routes()', desc: 'Get router middleware', returns: 'Middleware' },
        { name: 'allowedMethods()', desc: 'Get 405 handler middleware', returns: 'Middleware' },
      ],
    },
    {
      title: 'Context',
      methods: [
        { name: 'method', desc: 'HTTP method (GET, POST, etc.)', returns: 'string' },
        { name: 'path', desc: 'Request path', returns: 'string' },
        { name: 'url', desc: 'Full request URL', returns: 'string' },
        { name: 'query', desc: 'Parsed query parameters', returns: 'Record<string, string>' },
        { name: 'params', desc: 'Route parameters', returns: 'Record<string, string>' },
        { name: 'headers', desc: 'Request headers', returns: 'Record<string, string>' },
        { name: 'body', desc: 'Parsed request body', returns: 'unknown' },
        { name: 'status', desc: 'Response status code', returns: 'number' },
        { name: 'responseBody', desc: 'Response body', returns: 'unknown' },
        { name: 'state', desc: 'Custom state object', returns: 'Record<string, unknown>' },
        { name: 'get(field)', desc: 'Get request header', returns: 'string | undefined' },
        { name: 'set(field, value)', desc: 'Set response header', returns: 'void' },
        { name: 'throw(status, message?)', desc: 'Throw HTTP error', returns: 'never' },
        { name: 'redirect(url)', desc: 'Redirect response', returns: 'void' },
      ],
    },
  ];
}
