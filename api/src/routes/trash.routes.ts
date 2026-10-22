import { Router } from 'express';
import { TrashController } from '../controllers/trash.controller';
import { auth } from '../middlewares/auth';

const router = Router();
const controller = new TrashController();

/**
 * @openapi
 * /api/trash:
 *   get:
 *     summary: Lista los elementos enviados a la papelera por el usuario
 *     description: Solo devuelve las raíces de eliminación (carpetas o archivos) con su contenido agrupado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Elementos en la papelera
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   resourceType: { type: string, enum: [folder, file] }
 *                   name: { type: string }
 *                   deletedAt: { type: string, format: date-time }
 *                   itemCount: { type: integer, description: Carpetas y archivos del grupo eliminado }
 *                   sizeBytes: { type: integer, description: Tamaño total de los archivos del grupo }
 *                   locationName:
 *                     type: string
 *                     nullable: true
 *                     description: Carpeta donde estaba el elemento
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', auth, controller.list);

/**
 * @openapi
 * /api/trash/{id}/contents:
 *   get:
 *     summary: Lista el contenido de una carpeta eliminada
 *     description: Devuelve las subcarpetas y los archivos que estaban dentro de una carpeta enviada a la papelera
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contenido de la carpeta eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 folderId: { type: string }
 *                 name: { type: string }
 *                 folders:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/TrashContentItem' }
 *                 files:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/TrashContentItem' }
 *       400:
 *         description: Id inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Solo el propietario puede ver la papelera
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: La carpeta eliminada no existe
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/contents', auth, controller.contents);

/**
 * @openapi
 * /api/trash/{id}/restore:
 *   patch:
 *     summary: Restaura un elemento de la papelera junto con su contenido
 *     description: Restaura el grupo completo de la eliminación (carpeta con sus subcarpetas y archivos, o archivo suelto). Si se envía destinationId se restaura en esa carpeta en lugar de la original
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               destinationId:
 *                 type: string
 *                 description: Carpeta donde restaurar el elemento
 *     responses:
 *       200:
 *         description: Elemento restaurado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resourceType: { type: string, enum: [folder, file] }
 *                 restored: { type: integer, description: Elementos restaurados }
 *       400:
 *         description: Id inválido, la carpeta destino ya no existe o pertenece a otro propietario
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Solo el propietario restaura
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: El elemento no está en la papelera
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe un elemento con ese nombre en el destino
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/restore', auth, controller.restore);

/**
 * @openapi
 * /api/trash/{id}/restore-item:
 *   patch:
 *     summary: Restaura un archivo o una subcarpeta concreto de la papelera
 *     description: Restaura un único elemento (archivo o subcarpeta) que está dentro de una carpeta eliminada, en la carpeta destino indicada. Si la subcarpeta tiene contenido, se restaura su subárbol completo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Id del archivo o subcarpeta a restaurar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [destinationId]
 *             properties:
 *               destinationId:
 *                 type: string
 *                 description: Carpeta donde restaurar el elemento
 *     responses:
 *       200:
 *         description: Elemento restaurado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resourceType: { type: string, enum: [folder, file] }
 *                 restored: { type: integer, description: Elementos restaurados }
 *       400:
 *         description: Id inválido o la carpeta destino pertenece a otro propietario
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Solo el propietario restaura
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: El elemento o la carpeta destino no existen
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: Ya existe un elemento con ese nombre en el destino
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/restore-item', auth, controller.restoreItem);

/**
 * @openapi
 * /api/trash/{id}:
 *   delete:
 *     summary: Elimina definitivamente un elemento de la papelera
 *     description: Borra el grupo completo de la eliminación (carpeta con sus subcarpetas y archivos, o archivo suelto), sus shares y su contenido en GridFS, y libera la cuota al propietario. Los logs se conservan
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Elemento eliminado definitivamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 resourceType: { type: string, enum: [folder, file] }
 *                 deleted: { type: integer, description: Recursos eliminados }
 *                 freedBytes: { type: integer, description: Cuota liberada }
 *       400:
 *         description: Id inválido o el elemento no pertenece a una eliminación
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Solo el propietario elimina definitivamente
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: El elemento no está en la papelera
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/:id', auth, controller.remove);

export default router;
