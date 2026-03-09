import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IAttachmentRef {
  uploadId: string;
  contentType: string;
  purpose: string;
}

export interface IMessage {
  messageId: string;
  threadId: string;
  senderUserId: string;
  senderRole: 'client' | 'therapist' | 'admin';
  /** PHI */
  text: string;
  attachments: IAttachmentRef[];
  createdAt: Date;
}

type IMessageDoc = Omit<IMessage, 'messageId'>;

export type MessageDocument = HydratedDocument<IMessageDoc>;

const AttachmentRefSchema = new Schema<IAttachmentRef>(
  {
    uploadId: { type: String, required: true, ref: 'Upload' },
    contentType: { type: String, required: true },
    purpose: { type: String, required: true },
  },
  { _id: false },
);

const MessageSchema = new Schema<IMessageDoc>(
  {
    threadId: {
      type: String,
      required: true,
      ref: 'MessageThread',
    },
    senderUserId: {
      type: String,
      required: true,
      ref: 'User',
    },
    senderRole: {
      type: String,
      enum: ['client', 'therapist', 'admin'],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    attachments: {
      type: [AttachmentRefSchema],
      required: true,
      default: [],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['messageId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

MessageSchema.index({ threadId: 1, createdAt: 1 });

export const MessageModel: Model<IMessageDoc> = mongoose.model<IMessageDoc>('Message', MessageSchema);
