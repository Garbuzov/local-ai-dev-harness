import { z } from 'zod'

/**
 * Environment variables are validated at application startup: a missing required
 * variable must break the build immediately, not at request time.
 * vite only injects variables with the VITE_ prefix, see `.env.example`.
 */
const envSchema = z.object({
  VITE_API_URL: z.string().default(''),
})

export const env = envSchema.parse(import.meta.env)
