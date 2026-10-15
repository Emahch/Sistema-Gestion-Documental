import { Router } from 'express';
import { FolderController } from '../controllers/folder.controller';
import { auth } from '../middlewares/auth';

const router = Router();
const controller = new FolderController();

/**
 * @openapi
 * components:
 *   schemas:
 *     Folder:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         ownerId: { type: string }
 *         parentId: { type: string, nullable: true }
 *         isRoot: { type: boolean }
 *         name: { type: string }
 *         ancestors: { type: array, items: { type: string } }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     CreateFolder:
 *       type: object
 *       required: [parentId, name]
 *       properties:
 *         parentId: { type: string, description: Id de la carpeta padre }
 *         name: { type: string, example: Proyectos }
 */

/**
 * @openapi
 * /api/folders:
 *   get:
 *     summary: Lista el contenido de una carpeta (solo árbol propio)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: parentId
 *         schema: { type: string }
 *         description: Id de la carpeta; omitido lista la raíz
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Carpetas y archivos de la carpeta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 folders:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Folder' }
 *                 files:
 *                   type: array
 *                   items: { type: object }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso a la carpeta
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Carpeta no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', auth, controller.list);

/**
 * @openapi
 * /api/folders:
 *   post:
 *     summary: Crea una carpeta dentro del padre indicado
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateFolder' }
 *     responses:
 *       201:
 *         description: Carpeta creada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Folder' }
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso a la carpeta padre
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Carpeta padre no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe una carpeta con ese nombre
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', auth, controller.create);

/**
 * @openapi
 * /api/folders/root:
 *   get:
 *     summary: Devuelve la carpeta raíz del usuario
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Carpeta raíz
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Folder' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Raíz no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/root', auth, controller.root);

/**
 * @openapi
 * /api/folders/{id}:
 *   patch:
 *     summary: Renombra una carpeta (la raíz no puede renombrarse)
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
 *         description: Carpeta renombrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Folder' }
 *       400:
 *         description: Datos inválidos o es la raíz
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso a la carpeta
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Carpeta no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe una carpeta con ese nombre
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', auth, controller.rename);

/**
 * @openapi
 * /api/folders/{id}/move:
 *   patch:
 *     summary: Mueve una carpeta a otro destino del mismo árbol
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
 *         description: Carpeta movida
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Folder' }
 *       400:
 *         description: Movimiento inválido (ciclos, raíz, contenido ajeno, nombre ocupado)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso a la carpeta o al destino
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Carpeta o destino no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe una carpeta con ese nombre en el destino
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/move', auth, controller.move);

/**
 * @openapi
 * /api/folders/{id}/breadcrumb:
 *   get:
 *     summary: Cadena de carpetas desde la raíz hasta la indicada
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ruta de carpetas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Folder' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Sin acceso a la carpeta
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Carpeta no encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/breadcrumb', auth, controller.breadcrumb);

export default router;
