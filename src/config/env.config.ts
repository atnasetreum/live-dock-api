export const EnvConfiguration = () => ({
  environment: process.env.NODE_ENV,
  appKey: process.env.APP_KEY,
  publicBackendUrl: process.env.PUBLIC_BACKEND_URL,
  jwt: {
    secretKey: process.env.JWT_SECRET_KEY,
  },
});
