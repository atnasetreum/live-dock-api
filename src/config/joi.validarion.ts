import Joi, { type ObjectSchema } from 'joi';

interface EnvValidationSchema {
  NODE_ENV: string;
  PORT: number;
  APP_KEY: string;
  WHITE_LIST_DOMAINS: string;
  JWT_SECRET_KEY: string;
  DB_HOST: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  DB_PORT: number;
}

export const JoiValidationSchema: ObjectSchema<EnvValidationSchema> =
  Joi.object<EnvValidationSchema>({
    NODE_ENV: Joi.string().required(),
    PORT: Joi.number().required(),
    APP_KEY: Joi.string().required(),
    WHITE_LIST_DOMAINS: Joi.string().required(),
    JWT_SECRET_KEY: Joi.string().required(),
    DB_HOST: Joi.string().required(),
    DB_USERNAME: Joi.string().required(),
    DB_PASSWORD: Joi.string().required(),
    DB_NAME: Joi.string().required(),
    DB_PORT: Joi.number().required(),
  });
