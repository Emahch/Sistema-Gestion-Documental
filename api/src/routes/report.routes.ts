import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { auth } from '../middlewares/auth';
import { requireAdmin } from '../middlewares/require-admin';

const router = Router();
const controller = new ReportController();

router.use(auth, requireAdmin);

/**
 * @openapi
 * /api/reports/users:
 *   get:
 *     summary: Lista usuarios para los selectores de reportes (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuarios ordenados por email
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   email: { type: string }
 *                   role: { type: string, enum: [admin, user] }
 *                   isActive: { type: boolean }
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/users', controller.users);

/**
 * @openapi
 * /api/reports/files-by-category:
 *   get:
 *     summary: R1 - Cantidad de archivos agrupados por tipo (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteo y tamaño por categoría, excluyendo eliminados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category: { type: string, enum: [TXT, MD] }
 *                       count: { type: integer }
 *                       sizeBytes: { type: integer }
 *                 totalFiles: { type: integer }
 *                 totalBytes: { type: integer }
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/files-by-category', controller.filesByCategory);

/**
 * @openapi
 * /api/reports/files-by-date:
 *   get:
 *     summary: R2 - Archivos creados dentro de un rango de fechas (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Archivos creados en el rango, con total y bytes; se conservan aunque se eliminen definitivamente
 *       400:
 *         description: Rango de fechas inválido
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/files-by-date', controller.filesByDate);

/**
 * @openapi
 * /api/reports/top-files:
 *   get:
 *     summary: R3 - Archivos con mayor cantidad de operaciones exitosas (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Ranking de archivos; usa el snapshot si el archivo ya no existe
 *       400:
 *         description: Rango de fechas inválido
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/top-files', controller.topFiles);

/**
 * @openapi
 * /api/reports/top-users-by-files:
 *   get:
 *     summary: R4 - Top 10 usuarios con más archivos almacenados (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuarios ordenados por cantidad de archivos activos
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/top-users-by-files', controller.topUsersByFiles);

/**
 * @openapi
 * /api/reports/top-users-by-shared:
 *   get:
 *     summary: R5 - Usuarios con más recursos compartidos (solo admin)
 *     description: Cuenta recursos distintos compartidos (manual y automático).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *     responses:
 *       200:
 *         description: Ranking con desglose manual y automático
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/top-users-by-shared', controller.topUsersByShared);

/**
 * @openapi
 * /api/reports/top-shared-files:
 *   get:
 *     summary: R6 - Archivos compartidos con más usuarios (solo admin)
 *     description: Considera únicamente shares manuales y usuarios distintos.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *     responses:
 *       200:
 *         description: Ranking de archivos compartidos
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/top-shared-files', controller.topSharedFiles);

/**
 * @openapi
 * /api/reports/shared-by-user:
 *   get:
 *     summary: R7 - Recursos compartidos por un usuario (solo admin)
 *     description: Incluye shares manuales y automáticos, agrupados por recurso.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Recursos compartidos con cantidad de destinatarios
 *       400:
 *         description: userId inválido
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/shared-by-user', controller.sharedByUser);

/**
 * @openapi
 * /api/reports/received-by-user:
 *   get:
 *     summary: R8 - Recursos recibidos por un usuario (solo admin)
 *     description: Incluye shares manuales y automáticos.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Recursos recibidos con propietario, permiso y origen
 *       400:
 *         description: userId inválido
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/received-by-user', controller.receivedByUser);

/**
 * @openapi
 * /api/reports/user-activity:
 *   get:
 *     summary: R9 - Historial de actividad exitosa de un usuario en un rango (solo admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 100 }
 *     responses:
 *       200:
 *         description: Historial paginado ordenado del más reciente al más antiguo
 *       400:
 *         description: Parámetros inválidos
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 *       404:
 *         description: Usuario no encontrado
 */
router.get('/user-activity', controller.userActivity);

/**
 * @openapi
 * /api/reports/operations-by-action:
 *   get:
 *     summary: R10 - Operaciones exitosas agrupadas por tipo de operación (solo admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteo por acción, ordenado de mayor a menor
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/operations-by-action', controller.operationsByAction);

/**
 * @openapi
 * /api/reports/operations-by-period:
 *   get:
 *     summary: R11 - Operaciones exitosas agrupadas por período (solo admin)
 *     description: Usa $dateTrunc con zona horaria America/Guatemala.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: granularity
 *         schema: { type: string, enum: [day, week, month], default: day }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Conteo por período ordenado cronológicamente
 *       400:
 *         description: Rango de fechas inválido
 *       401:
 *         description: Sin token o inactivo
 *       403:
 *         description: Se requiere rol de administrador
 */
router.get('/operations-by-period', controller.operationsByPeriod);

export default router;
