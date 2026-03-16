import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IUpload {
  uploadId: string;
  patientId?: string;
  createdByUserId: string;
  ownerRole: 'client' | 'therapist' | 'admin';
  purpose: 'practice_video' | 'message_attachment' | 'therapist_feedback' | 'exercise_media';
  contentType: string;
  sizeBytes: number;
  s3Key: string;
  s3Bucket: string;
  status: 'pending' | 'available' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

type IUploadDoc = Omit<IUpload, 'uploadId'>;

export type UploadDocument = HydratedDocument<IUploadDoc>;

const UploadSchema = new Schema<IUploadDoc>(
  {
    patientId: {
      type: String,
      ref: 'PatientProfile',
    },
    createdByUserId: {
      type: String,
      required: true,
      ref: 'User',
    },
    ownerRole: {
      type: String,
      enum: ['client', 'therapist', 'admin'],
      required: true,
    },
    purpose: {
      type: String,
      enum: ['practice_video', 'message_attachment', 'therapist_feedback', 'exercise_media'],
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 0,
    },
    s3Key: {
      type: String,
      required: true,
    },
    s3Bucket: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'available', 'failed'],
      required: true,
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['uploadId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

UploadSchema.index({ patientId: 1 });
UploadSchema.index({ status: 1 });

export const UploadModel: Model<IUploadDoc> = (mongoose.models['Upload'] as Model<IUploadDoc>) ?? mongoose.model<IUploadDoc>('Upload', UploadSchema);
