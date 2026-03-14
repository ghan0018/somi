import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IPatientProfile {
  patientId: string;
  userId: string;
  displayName: string;
  status: 'active' | 'inactive';
  primaryTherapistId?: string;
  clinicId: string;
  createdAt: Date;
  updatedAt: Date;
}

type IPatientProfileDoc = Omit<IPatientProfile, 'patientId'>;

export type PatientProfileDocument = HydratedDocument<IPatientProfileDoc>;

const PatientProfileSchema = new Schema<IPatientProfileDoc>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      ref: 'User',
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      required: true,
      default: 'active',
    },
    primaryTherapistId: {
      type: String,
      ref: 'User',
    },
    clinicId: {
      type: String,
      required: true,
      default: 'default_clinic',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['patientId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

// userId already has unique: true on the field definition, which creates an index
PatientProfileSchema.index({ primaryTherapistId: 1 });
PatientProfileSchema.index({ status: 1 });

export const PatientProfileModel: Model<IPatientProfileDoc> =
  (mongoose.models['PatientProfile'] as Model<IPatientProfileDoc>) ?? mongoose.model<IPatientProfileDoc>('PatientProfile', PatientProfileSchema);
