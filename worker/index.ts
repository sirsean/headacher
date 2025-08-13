import app from './hono-app';

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
