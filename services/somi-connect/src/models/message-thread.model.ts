import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IMessageThread {
  threadId: string;
  patientId: string;
  therapistUserId: string;
  status: 'active' | 'archived';
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

type IMessageThreadDoc = Omit<IMessageThread, 'threadId'>;

export type MessageThreadDocument = HydratedDocument<IMessageThreadDoc>;

const MessageThreadSchema = new Schema<IMessageThreadDoc>(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      ref: 'PatientProfile',
    },
    therapistUserId: {
      type: String,
      required: true,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      required: true,
      default: 'active',
    },
    lastMessageAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['threadId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

// patientId already has unique: true on the field definition

export const MessageThreadModel: Model<IMessageThreadDoc> =
  (mongoose.models['MessageThread'] as Model<IMessageThreadDoc>) ?? mongoose.model<IMessageThreadDoc>('MessageThread', MessageThreadSchema);
