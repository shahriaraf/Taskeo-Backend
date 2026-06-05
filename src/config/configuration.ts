export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10) || 100,
  },
});