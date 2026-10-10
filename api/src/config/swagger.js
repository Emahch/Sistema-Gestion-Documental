const swaggerJsdoc = require('swagger-jsdoc');

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
      schemas: {
        Error: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', example: 'Documento no encontrado' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js', './src/server.js'],
};

module.exports = { swaggerSpec: swaggerJsdoc(options) };
