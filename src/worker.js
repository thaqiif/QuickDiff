// Cloudflare Worker entry using Hono to serve static assets and minimal API
import { Hono } from 'hono'

export default {
  async fetch(request, env, ctx) {
    const app = new Hono()

    // Simple health endpoint
    app.get('/api/health', (c) => c.json({ status: 'ok' }))

    // Fallback: serve static asset via Workers Assets binding
    app.all('*', async (c) => {
      // If assets binding configured
      if (env.ASSETS && env.ASSETS.fetch) {
        return env.ASSETS.fetch(request)
      }
      return c.text('Not found', 404)
    })

    return app.fetch(request, env, ctx)
  }
}