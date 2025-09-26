import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS aktivieren für Frontend-Kommunikation (auch von anderen Rechnern)
  app.enableCors({
    origin: function (origin, callback) {
      // Erlaubt alle Origins in der Entwicklung (NODE_ENV ist normalerweise nicht gesetzt in dev)
      if (!origin || !process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        // In Produktion nur spezifische Origins erlauben
        const allowedOrigins = [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
          'http://localhost:3002',
          'http://127.0.0.1:3002',
          'http://localhost:3006',
          'http://127.0.0.1:3006',
          // Fügen Sie hier weitere erlaubte Origins hinzu
        ];
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('My API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // UI unter /docs, JSON unter /docs-json

  const port = process.env.PORT || 3002;
  const host = process.env.HOST || '0.0.0.0'; // Bindet an alle Netzwerk-Interfaces
  
  await app.listen(port, host);
  
  // Zeige alle verfügbaren Zugriffsmöglichkeiten
  console.log(`🚀 API läuft auf:`);
  console.log(`   - Lokal: http://localhost:${port}`);
  console.log(`   - Netzwerk: http://0.0.0.0:${port} (von anderen Rechnern erreichbar)`);
  console.log(`📚 Swagger Docs verfügbar unter:`);
  console.log(`   - http://localhost:${port}/docs`);
  console.log(`   - http://0.0.0.0:${port}/docs`);
  console.log(`💡 Für Zugriff von anderen Rechnern: http://[IHRE-IP-ADRESSE]:${port}`);
}
bootstrap();
