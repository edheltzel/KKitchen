declare module 'cloudflare:workers' {
  export const env: Cloudflare.Env;
}

type D1Database = import('@cloudflare/workers-types').D1Database;
type R2Bucket = import('@cloudflare/workers-types').R2Bucket;

declare namespace Cloudflare {
  interface Env {
    RECIPES: R2Bucket;
    DB: D1Database;
  }
}

declare namespace App {
  interface Locals {
    person: 'ed' | 'kristina';
    runtime: { env: Cloudflare.Env };
  }
}
