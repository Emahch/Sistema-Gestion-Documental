import express, { Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { env } from './config/env';
import { connectDB } from './config/db';
import { notFound, errorHandler } from './middlewares/errors';
import authRouter from './routes/auth.routes';
import userRouter from './routes/user.routes';
import folderRouter from './routes/folder.routes';
import fileRouter from './routes/file.routes';
import shareRouter from './routes/share.routes';
import trashRouter from './routes/trash.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (req: Request, res: Response) => res.json(swaggerSpec));

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Verifica que el API está corriendo
 *     responses:
 *       200:
 *         description: API en funcionamiento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/folders', folderRouter);
app.use('/api/files', fileRouter);
app.use('/api/shares', shareRouter);
app.use('/api/trash', trashRouter);

app.use(notFound);
app.use(errorHandler);

async function start(): Promise<void> {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`API escuchando en http://localhost:${env.port}`);
  });
}

start().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
