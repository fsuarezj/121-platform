import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';

import { ApplicationModule } from '@mock-service/src/app.module';
import {
  APP_FAVICON,
  APP_TITLE,
  APP_VERSION,
  DEVELOPMENT,
  PORT,
  SWAGGER_CUSTOM_CSS,
} from '@mock-service/src/config';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace NodeJS {
    interface Global {
      queueCallbacks: Record<string, string>;
    }
  }
}

global.queueCallbacks = {};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApplicationModule);

  const expressInstance = app.getHttpAdapter().getInstance();

  expressInstance.disable('x-powered-by');

  app.setGlobalPrefix('api');

  const options = new DocumentBuilder()
    .setTitle(APP_TITLE)
    .setVersion(APP_VERSION)
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('/docs', app, document, {
    customSiteTitle: APP_TITLE,
    customfavIcon: APP_FAVICON,
    customCss: SWAGGER_CUSTOM_CSS,
    swaggerOptions: {
      // See: https://github.com/swagger-api/swagger-ui/blob/master/docs/usage/configuration.md
      deepLinking: true,
      defaultModelExpandDepth: 10,
      defaultModelsExpandDepth: 1,
      displayOperationId: true,
      displayRequestDuration: true,
      filter: true,
      operationsSorter: 'alpha',
      queryConfigEnabled: DEVELOPMENT,
      showCommonExtensions: true,
      showExtensions: true,
      tagsSorter: 'alpha',
      tryItOutEnabled: DEVELOPMENT,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: false,
      exceptionFactory: (errors) => {
        for (const e of errors) {
          if (e.constraints && e.constraints['unknownValue']) {
            console.log('e: ', e);
            throw new HttpException(e, HttpStatus.INTERNAL_SERVER_ERROR);
          }
        }
        throw new BadRequestException(errors);
      },
    }),
  );
  app.use(bodyParser.json());
  app.use(
    bodyParser.urlencoded({
      extended: true,
    }),
  );
  await app.listen(PORT);
}
void bootstrap();
