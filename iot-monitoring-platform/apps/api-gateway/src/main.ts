import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { swaggerConfig } from './config/swagger.config';
import { AllExceptionsFilter } from '@app/common/filters';
import { LoggingInterceptor } from '@app/common/interceptors';

// fetchBase: URL interna usada por Node.js para obtener el spec (Docker usa nombre de contenedor)
// publicUrl: URL que el BROWSER usa para hacer los requests (siempre localhost desde la máquina host)
const SERVICES = [
  {
    fetchBase: process.env.DEVICE_SERVICE_URL       ?? 'http://localhost:3001',
    publicUrl: process.env.DEVICE_SERVICE_PUBLIC_URL ?? 'http://localhost:3001',
  },
  {
    fetchBase: process.env.ANALYTICS_SERVICE_URL    ?? 'http://localhost:3002',
    publicUrl: process.env.ANALYTICS_SERVICE_PUBLIC_URL ?? 'http://localhost:3002',
  },
  {
    fetchBase: process.env.ALERTS_SERVICE_URL       ?? 'http://localhost:3003',
    publicUrl: process.env.ALERTS_SERVICE_PUBLIC_URL ?? 'http://localhost:3003',
  },
  {
    fetchBase: process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3004',
    publicUrl: process.env.NOTIFICATION_SERVICE_PUBLIC_URL ?? 'http://localhost:3004',
  },
];

// Cada path del servicio lleva servers:[{url}] para que Swagger UI apunte al puerto correcto
function mergeInto(
  base: OpenAPIObject,
  doc: OpenAPIObject,
  servicePublicUrl: string,
): OpenAPIObject {
  for (const [path, pathItem] of Object.entries(doc.paths ?? {})) {
    (base.paths as Record<string, unknown>)[path] = {
      ...(pathItem as object),
      servers: [{ url: servicePublicUrl }],
    };
  }
  base.components ??= {};
  base.components.schemas = {
    ...base.components.schemas,
    ...(doc.components?.schemas ?? {}),
  };
  const seen = new Set((base.tags ?? []).map((t) => t.name));
  for (const tag of doc.tags ?? []) {
    if (!seen.has(tag.name)) base.tags = [...(base.tags ?? []), tag];
  }
  return base;
}

async function buildMergedDoc(
  gatewayDoc: OpenAPIObject,
  logger: Logger,
): Promise<OpenAPIObject> {
  const results = await Promise.all(
    SERVICES.map(async ({ fetchBase, publicUrl }) => {
      const url = `${fetchBase}/api/docs-json`;
      try {
        const r = await fetch(url);
        if (!r.ok) {
          logger.warn(`Swagger merge: ${url} responded ${r.status}`);
          return null;
        }
        logger.log(`Swagger merge: fetched ${url}`);
        return { doc: (await r.json()) as OpenAPIObject, publicUrl };
      } catch {
        logger.warn(`Swagger merge: ${url} unreachable (service not running?)`);
        return null;
      }
    }),
  );

  return results.reduce(
    (acc: OpenAPIObject, result) =>
      result ? mergeInto(acc, result.doc, result.publicUrl) : acc,
    JSON.parse(JSON.stringify(gatewayDoc)) as OpenAPIObject,
  );
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const gatewayDoc = SwaggerModule.createDocument(app, swaggerConfig);

  // Cached merged doc — starts as gateway-only, refreshed in background
  let cachedDoc: OpenAPIObject = gatewayDoc;

  SwaggerModule.setup('api/docs', app, gatewayDoc, {
    patchDocumentOnRequest: (_req, _res, _document) => cachedDoc,
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'IoT Monitoring Platform – API Docs',
  });

  const port = process.env.API_GATEWAY_PORT || 3000;
  await app.listen(port);
  logger.log(`API Gateway running on: http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);

  // Fetch and merge all service specs in background; refresh every 30s
  const refresh = async () => {
    cachedDoc = await buildMergedDoc(gatewayDoc, logger);
  };
  refresh();
  setInterval(refresh, 30_000);
}
bootstrap();
