import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'BetMaster API',
            version: '1.0.0',
            description: 'Complete API documentation for BetMaster Gaming Platform',
            contact: {
                name: 'BetMaster Support',
                email: 'support@betmaster.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:5000/api/v1',
                description: 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        }
    },
    apis: ['./Routes/*.js'] // Path to route files
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;