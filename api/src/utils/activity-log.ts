import type { ClientSession, Types } from 'mongoose';
import { mongoose } from '../config/db';
import { ActivityLogModel } from '../models/activity-log.model';
import { UserModel } from '../models/user.model';
import type { ActivityAction } from '../types/activity-log';

interface ActivityLogInput {
  actorId: string | Types.ObjectId;
  action: ActivityAction;
  status: 'success' | 'error';
  resourceType: string;
  resourceId: Types.ObjectId;
  resourceSnapshot?: Record<string, unknown>;
  details?: Record<string, unknown>;
  affectedUserIds?: Types.ObjectId[];
  session?: ClientSession;
}

export async function createActivityLogs(inputs: ActivityLogInput[]): Promise<void> {
  if (inputs.length === 0) {
    return;
  }
  const first = inputs[0];
  const actorIds = new Set(inputs.map((input) => String(input.actorId)));
  if (actorIds.size !== 1) {
    throw new Error('Una escritura de actividad debe usar un único actor');
  }
  const actorId = typeof first.actorId === 'string' ? new mongoose.Types.ObjectId(first.actorId) : first.actorId;
  const session = first.session;
  const actor = await UserModel.findById(actorId, { email: 1 }).lean().session(session ?? null);
  const logs = inputs.map((input) => ({
    userId: actorId,
    userEmail: actor?.email ?? null,
    action: input.action,
    status: input.status,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    resourceSnapshot: input.resourceSnapshot ?? {},
    details: input.details ?? {},
    affectedUserIds: input.affectedUserIds ?? [],
  }));
  await ActivityLogModel.create(logs, session ? { session, ordered: true } : undefined);
}

export async function createActivityLog(input: ActivityLogInput): Promise<void> {
  await createActivityLogs([input]);
}
