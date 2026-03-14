import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IParamsOverride {
  reps?: number;
  sets?: number;
  seconds?: number;
}

export interface IAssignment {
  assignmentKey: string;
  exerciseId: string;
  exerciseVersionId: string;
  index: number;
  paramsOverride?: IParamsOverride;
}

export interface ISession {
  sessionKey: string;
  index: number;
  title?: string;
  /** Patient-visible notes from the therapist — safe to return to clients */
  sessionNotes?: string;
  /** PHI — must never be returned to clients */
  notesForTherapistOnly?: string;
  timesPerDay: number;
  assignments: IAssignment[];
}

export interface ITreatmentPlan {
  planId: string;
  patientId: string;
  status: 'draft' | 'published' | 'archived';
  remindersEnabled: boolean;
  publishedAt?: Date;
  publishedBy?: string;
  sessions: ISession[];
  createdAt: Date;
  updatedAt: Date;
}

type ITreatmentPlanDoc = Omit<ITreatmentPlan, 'planId'>;

export type TreatmentPlanDocument = HydratedDocument<ITreatmentPlanDoc>;

const ParamsOverrideSchema = new Schema<IParamsOverride>(
  {
    reps: { type: Number, min: 0 },
    sets: { type: Number, min: 0 },
    seconds: { type: Number, min: 0 },
  },
  { _id: false },
);

const AssignmentSchema = new Schema<IAssignment>(
  {
    assignmentKey: { type: String, required: true },
    exerciseId: { type: String, required: true, ref: 'Exercise' },
    exerciseVersionId: { type: String, required: true, ref: 'ExerciseVersion' },
    index: { type: Number, required: true, min: 0 },
    paramsOverride: { type: ParamsOverrideSchema },
  },
  { _id: false },
);

const SessionSchema = new Schema<ISession>(
  {
    sessionKey: { type: String, required: true },
    index: { type: Number, required: true, min: 0 },
    title: { type: String, trim: true },
    sessionNotes: { type: String, trim: true },
    notesForTherapistOnly: { type: String },
    timesPerDay: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
      default: 1,
    },
    assignments: {
      type: [AssignmentSchema],
      required: true,
      default: [],
    },
  },
  { _id: false },
);

const TreatmentPlanSchema = new Schema<ITreatmentPlanDoc>(
  {
    patientId: {
      type: String,
      required: true,
      ref: 'PatientProfile',
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      required: true,
      default: 'draft',
    },
    remindersEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    publishedBy: {
      type: String,
      ref: 'User',
    },
    sessions: {
      type: [SessionSchema],
      required: true,
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['planId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

// Compound index covers patientId-only queries too (left-prefix rule)
TreatmentPlanSchema.index({ patientId: 1, status: 1 });

export const TreatmentPlanModel: Model<ITreatmentPlanDoc> =
  mongoose.model<ITreatmentPlanDoc>('TreatmentPlan', TreatmentPlanSchema);
