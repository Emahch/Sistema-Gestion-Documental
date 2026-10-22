import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { auth } from '../middlewares/auth';
import { requireAdmin } from '../middlewares/require-admin';
import { requireSelfOrAdmin } from '../middlewares/require-self-or-admin';

const router = Router();
const controller = new UserController();

/**
 * @openapi
 * components:
 *   schemas:
 *     CreateUser:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           example: juan@example.com
 *         password:
 *           type: string
 *           format: password
 *         role:
 *           type: string
 *           enum: [admin, user]
 *           default: user
 *         quotaBytes:
 *           type: number
 *           nullable: true
 *           description: Cuota en bytes; null significa ilimitada
 */

/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Crea un usuario con su carpeta raíz (solo admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Se requiere rol de administrador
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: El email ya está registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', auth, requireAdmin, controller.create);

/**
 * @openapi
 * /api/users/me:
 *   patch:
 *     summary: Edita el perfil propio (email y/o password)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Perfil actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
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
 *       409:
 *         description: El email ya está registrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/me', auth, controller.updateSelf);

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Lista usuarios paginados (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Filtra por email (subcadena, sin mayúsculas)
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [admin, user] }
 *     responses:
 *       200:
 *         description: Página de usuarios (nunca incluye passwordHash)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/User' }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Se requiere rol de administrador
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', auth, requireAdmin, controller.list);

/**
 * @openapi
 * /api/users/by-email:
 *   get:
 *     summary: Resuelve id y email de un usuario por su email (para compartir)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Usuario encontrado (solo id y email)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 email: { type: string }
 *       400:
 *         description: Email inválido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/by-email', auth, controller.findByEmail);

/**
 * @openapi
 * /api/users/search:
 *   get:
 *     summary: Busca usuarios por email para autocompletar al compartir
 *     description: Devuelve como máximo 10 usuarios activos cuyo email contiene el texto; excluye al usuario autenticado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Texto a buscar (mínimo 2 caracteres)
 *     responses:
 *       200:
 *         description: Usuarios encontrados (solo id y email)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   email: { type: string }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/search', auth, controller.search);

/**
 * @openapi
 * /api/users/{id}/status:
 *   patch:
 *     summary: Activa o desactiva un usuario (solo admin)
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
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: isActive no es booleano
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Se requiere rol de administrador
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/status', auth, requireAdmin, controller.setStatus);

/**
 * @openapi
 * /api/users/{id}/quota:
 *   patch:
 *     summary: Ajusta la cuota de un usuario (solo admin)
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
 *             required: [quotaBytes]
 *             properties:
 *               quotaBytes:
 *                 type: number
 *                 nullable: true
 *                 description: null significa ilimitada
 *     responses:
 *       200:
 *         description: Cuota actualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Valor inválido (negativo o no numérico)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Se requiere rol de administrador
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id/quota', auth, requireAdmin, controller.setQuota);

/**
 * @openapi
 * /api/users/{id}/storage:
 *   get:
 *     summary: Consulta uso, cuota y disponible (admin o propio)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: reconcile
 *         schema: { type: boolean }
 *         description: Compara con la suma real de archivos
 *     responses:
 *       200:
 *         description: Estado de almacenamiento
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usedBytes: { type: integer }
 *                 quotaBytes: { type: integer, nullable: true }
 *                 available: { type: integer, nullable: true }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Solo tu propia información o ser admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/storage', auth, requireSelfOrAdmin, controller.storage);

/**
 * @openapi
 * /api/users/{id}:
 *   patch:
 *     summary: Edita email, rol y/o password de un usuario (solo admin)
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
 *             properties:
 *               email: { type: string }
 *               password: { type: string, format: password }
 *               role: { type: string, enum: [admin, user] }
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Datos inválidos o cambio sobre sí mismo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       401:
 *         description: Sin token o inactivo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       403:
 *         description: Se requiere rol de administrador
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       409:
 *         description: El email ya está registrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.patch('/:id', auth, requireAdmin, controller.update);

export default router;
