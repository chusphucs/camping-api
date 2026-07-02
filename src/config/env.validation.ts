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
  // Email notifications (Resend) are OPTIONAL — the app still boots and takes
  // orders without them; MailService no-ops when the key/recipient are absent.
  RESEND_API_KEY: Joi.string().allow('').optional(),
  ADMIN_EMAIL: Joi.string().email().allow('').optional(),
  MAIL_FROM: Joi.string().default('Camping Rental <onboarding@resend.dev>'),
});
