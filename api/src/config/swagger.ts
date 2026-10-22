import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DocsDrive API',
      version: '1.0.0',
      description: 'API del Sistema de Gestión Documental',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', example: 'Error en la solicitud' },
          },
        },
        TrashContentItem: {
          type: 'object',
          required: ['id', 'resourceType', 'name', 'deletedAt', 'sizeBytes', 'itemCount'],
          properties: {
            id: { type: 'string' },
            resourceType: { type: 'string', enum: ['folder', 'file'] },
            name: { type: 'string' },
            deletedAt: { type: 'string', format: 'date-time' },
            sizeBytes: { type: 'integer', description: 'Tamaño de los archivos que contiene' },
            itemCount: { type: 'integer', description: 'Carpetas y archivos que contiene' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/server.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
