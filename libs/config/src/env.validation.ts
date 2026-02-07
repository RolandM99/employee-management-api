import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  APP_PORT: Joi.number().default(3000),
  APP_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_DATABASE: Joi.string().required(),

  // JWT
  JWT_SECRET: Joi.string().required().min(8),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required().min(8),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),

  // Mail
  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().default(2525),
  MAIL_USER: Joi.string().required(),
  MAIL_PASS: Joi.string().required(),
  MAIL_FROM: Joi.string().required(),
  MAIL_TRANSPORT: Joi.string().valid('smtp', 'ethereal', 'console').default('console'),

  // Frontend
  FRONTEND_RESET_URL: Joi.string().uri().required(),
});
