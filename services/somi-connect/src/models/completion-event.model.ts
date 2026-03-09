import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface ICompletionEvent {
  completionId: string;
  patientId: string;
  planId: string;
  dateLocal: string;
  occurrence: number;
  exerciseId: string;
  exerciseVersionId: string;
  completedAt: Date;
  source: 'mobile_ios' | 'mobile_android' | 'web';
  idempotencyKey?: string;
  createdAt: Date;
}

type ICompletionEventDoc = Omit<ICompletionEvent, 'completionId'>;

export type CompletionEventDocument = HydratedDocument<ICompletionEventDoc>;

const CompletionEventSchema = new Schema<ICompletionEventDoc>(
  {
    patientId: {
      type: String,
      required: true,
      ref: 'PatientProfile',
    },
    planId: {
      type: String,
      required: true,
      ref: 'TreatmentPlan',
    },
    dateLocal: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    occurrence: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
    },
    exerciseId: {
      type: String,
      required: true,
      ref: 'Exercise',
    },
    exerciseVersionId: {
      type: String,
      required: true,
      ref: 'ExerciseVersion',
    },
    completedAt: {
      type: Date,
      required: true,
    },
    source: {
      type: String,
      enum: ['mobile_ios', 'mobile_android', 'web'],
      required: true,
    },
    idempotencyKey: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['completionId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

CompletionEventSchema.index(
  { patientId: 1, dateLocal: 1, occurrence: 1, exerciseVersionId: 1 },
  { unique: true },
);
CompletionEventSchema.index({ patientId: 1, dateLocal: 1 });
CompletionEventSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const CompletionEventModel: Model<ICompletionEventDoc> =
  mongoose.model<ICompletionEventDoc>('CompletionEvent', CompletionEventSchema);
