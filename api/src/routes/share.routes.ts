import { Router } from 'express';
import { ShareController } from '../controllers/share.controller';
import { auth } from '../middlewares/auth';

const router = Router();
const controller = new ShareController();

/**
 * @openapi
 * components:
 *   schemas:
 *     Share:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         resourceType: { type: string, enum: [file, folder] }
 *         resourceId: { type: string }
 *         ownerId: { type: string }
 *         ownerEmail: { type: string }
 *         sharedWithId: { type: string }
 *         sharedWithEmail: { type: string }
 *         permission: { type: string, enum: [read, edit] }
 *         origin: { type: string, enum: [manual, auto] }
 *         resourceName: { type: string }
 *         createdAt: { type: string, format: date-time }
 *     ShareInput:
 *       type: object
 *       required: [resourceType, resourceId, sharedWithId, permission]
 *       properties:
 *         resourceType: { type: string, enum: [file, folder] }
 *         resourceId: { type: string }
 *         sharedWithId: { type: string }
 *         permission: { type: string, enum: [read, edit] }
 */

/**
 * @openapi
 * /api/shares:
 *   post:
 *     summary: Comparte un recurso (solo el propietario; crea o actualiza)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ShareInput' }
 *     responses:
 *       200:
 *         description: Permiso actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Share' }
 *       201:
 *         description: Recurso compartido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Share' }
 *       400:
 *         description: Datos inválidos, raíz o destino inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Solo el propietario puede compartir
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Recurso o usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', auth, controller.share);

/**
 * @openapi
 * /api/shares:
 *   patch:
 *     summary: Modifica un permiso existente (solo el propietario)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resourceId, sharedWithId, permission]
 *             properties:
 *               resourceId: { type: string }
 *               sharedWithId: { type: string }
 *               permission: { type: string, enum: [read, edit] }
 *     responses:
 *       200:
 *         description: Permiso actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Share' }
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
 *         description: Solo el propietario administra permisos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Share no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/', auth, controller.update);

/**
 * @openapi
 * /api/shares:
 *   delete:
 *     summary: Retira un permiso (solo el propietario)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [resourceId, sharedWithId]
 *             properties:
 *               resourceId: { type: string }
 *               sharedWithId: { type: string }
 *     responses:
 *       204:
 *         description: Permiso retirado
 *       400:
 *         description: La carpeta contiene archivos ajenos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Solo el propietario administra permisos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Share no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.delete('/', auth, controller.remove);

/**
 * @openapi
 * /api/shares/resource:
 *   get:
 *     summary: Lista los permisos directos de un recurso (solo el propietario)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: resourceType
 *         required: true
 *         schema: { type: string, enum: [file, folder] }
 *       - in: query
 *         name: resourceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Permisos del recurso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Share' }
 *       400:
 *         description: Datos inválidos o recurso eliminado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Solo el propietario administra permisos
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Recurso no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/resource', auth, controller.forResource);

/**
 * @openapi
 * /api/shares/with-me:
 *   get:
 *     summary: Recursos compartidos conmigo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Listado paginado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Share' }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/with-me', auth, controller.withMe);

/**
 * @openapi
 * /api/shares/by-me:
 *   get:
 *     summary: Recursos que compartí manualmente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Listado paginado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Share' }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/by-me', auth, controller.byMe);

export default router;
