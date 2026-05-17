import app from './hono-app';
import { runScheduledGoogleHealthSync } from './services/google-health-sync';

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledGoogleHealthSync(env));
  },
} satisfies ExportedHandler<Env>;
