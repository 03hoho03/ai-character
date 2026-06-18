import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // #28 httpOnly JWT 쿠키 — 자격을 cross-origin(localhost는 same-site)에서 운반하려면 credentials 허용 필요.
  app.enableCors({ origin: 'http://localhost:3000', credentials: true });
  app.use(cookieParser());
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
