import { Router } from 'express';
import { FileController } from '../controllers/file.controller';
import { auth } from '../middlewares/auth';

const router = Router();
const controller = new FileController();

/**
 * @openapi
 * components:
 *   schemas:
 *     File:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         mimeType: { type: string }
 *         category: { type: string, enum: [TXT, MD] }
 *         size: { type: integer }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/files:
 *   post:
 *     summary: Sube un archivo .txt o .md a una carpeta (multipart)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, folderId]
 *             properties:
 *               file: { type: string, format: binary }
 *               folderId: { type: string }
 *     responses:
 *       201:
 *         description: Archivo creado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/File' }
 *       400:
 *         description: Extensión, MIME o UTF-8 inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso a la carpeta destino
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Carpeta destino no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe un archivo con ese nombre
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       413:
 *         description: Cuota excedida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', auth, controller.upload);

/**
 * @openapi
 * /api/files/{id}:
 *   get:
 *     summary: Metadatos de un archivo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Metadatos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/File' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso al archivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Archivo no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', auth, controller.getOne);

/**
 * @openapi
 * /api/files/{id}/content:
 *   get:
 *     summary: Descarga el contenido de un archivo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contenido binario
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso al archivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Archivo no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/content', auth, controller.download);

/**
 * @openapi
 * /api/files/{id}/content:
 *   put:
 *     summary: Reemplaza el contenido de un archivo (multipart)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Contenido actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/File' }
 *       400:
 *         description: Contenido inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso al archivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Archivo no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       413:
 *         description: Cuota excedida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/:id/content', auth, controller.edit);

/**
 * @openapi
 * /api/files/{id}:
 *   patch:
 *     summary: Renombra un archivo (conserva la extensión)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Archivo renombrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/File' }
 *       400:
 *         description: Nombre inválido o cambia la extensión
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso al archivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Archivo no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe un archivo con ese nombre
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', auth, controller.rename);

/**
 * @openapi
 * /api/files/{id}/move:
 *   patch:
 *     summary: Mueve un archivo a otra carpeta del mismo propietario
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [destinationId]
 *             properties:
 *               destinationId: { type: string }
 *     responses:
 *       200:
 *         description: Archivo movido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/File' }
 *       400:
 *         description: Movimiento inválido o entre propietarios
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso al archivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Archivo o destino no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe un archivo con ese nombre en el destino
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/move', auth, controller.move);

export default router;
