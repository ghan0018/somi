import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IAuditEvent {
  auditId: string;
  actorUserId: string;
  actorRole: 'client' | 'therapist' | 'admin';
  /** e.g. 'plan.publish', 'media.access', 'auth.login' */
  actionType: string;
  /** e.g. 'treatment_plan', 'upload', 'user' */
  resourceType: string;
  resourceId: string;
  patientId?: string;
  ip?: string;
  userAgent?: string;
  correlationId: string;
  createdAt: Date;
}

type IAuditEventDoc = Omit<IAuditEvent, 'auditId'>;

export type AuditEventDocument = HydratedDocument<IAuditEventDoc>;

const AuditEventSchema = new Schema<IAuditEventDoc>(
  {
    actorUserId: {
      type: String,
      required: true,
      ref: 'User',
    },
    actorRole: {
      type: String,
      enum: ['client', 'therapist', 'admin'],
      required: true,
    },
    actionType: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      required: true,
    },
    resourceId: {
      type: String,
      required: true,
    },
    patientId: {
      type: String,
      ref: 'PatientProfile',
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    correlationId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['auditId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

AuditEventSchema.index({ patientId: 1, createdAt: 1 });
AuditEventSchema.index({ actorUserId: 1 });
AuditEventSchema.index({ actionType: 1 });

export const AuditEventModel: Model<IAuditEventDoc> = mongoose.model<IAuditEventDoc>(
  'AuditEvent',
  AuditEventSchema,
);
