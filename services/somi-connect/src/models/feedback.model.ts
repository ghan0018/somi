import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IFeedback {
  feedbackId: string;
  patientId: string;
  therapistUserId: string;
  /** PHI */
  text: string;
  uploadId?: string;
  feedbackMediaUploadId?: string;
  createdAt: Date;
}

type IFeedbackDoc = Omit<IFeedback, 'feedbackId'>;

export type FeedbackDocument = HydratedDocument<IFeedbackDoc>;

const FeedbackSchema = new Schema<IFeedbackDoc>(
  {
    patientId: {
      type: String,
      required: true,
      ref: 'PatientProfile',
    },
    therapistUserId: {
      type: String,
      required: true,
      ref: 'User',
    },
    text: {
      type: String,
      required: true,
    },
    uploadId: {
      type: String,
      ref: 'Upload',
    },
    feedbackMediaUploadId: {
      type: String,
      ref: 'Upload',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['feedbackId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

FeedbackSchema.index({ patientId: 1, createdAt: 1 });

export const FeedbackModel: Model<IFeedbackDoc> = mongoose.model<IFeedbackDoc>(
  'Feedback',
  FeedbackSchema,
);
