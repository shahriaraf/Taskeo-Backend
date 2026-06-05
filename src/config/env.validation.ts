import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUrl, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsString()
  @IsOptional()
  CLOUDINARY_CLOUD_NAME: string = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_KEY: string = '';

  @IsString()
  @IsOptional()
  CLOUDINARY_API_SECRET: string = '';

  @IsUrl()
  @IsOptional()
  FRONTEND_URL: string = 'http://localhost:3000';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
  if (errors.length > 0) throw new Error(errors.toString());
  return validatedConfig;
  
}