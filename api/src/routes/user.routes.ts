import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { auth } from '../middlewares/auth';
import { requireAdmin } from '../middlewares/require-admin';

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

export default router;
