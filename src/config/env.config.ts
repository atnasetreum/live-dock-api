export const EnvConfiguration = () => ({
  environment: process.env.NODE_ENV,
  appKey: process.env.APP_KEY,
  jwt: {
    secretKey: process.env.JWT_SECRET_KEY,
  },
});
