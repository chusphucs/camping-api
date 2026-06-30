import * as Joi from 'joi';

/**
 * Boot-time env validation. The app refuses to start if required vars are missing
 * so a misconfigured deploy fails fast instead of at first request.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  FRONTEND_ORIGIN: Joi.string().default('http://localhost:5173'),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
});
