import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IDefaultParams {
  reps?: number;
  sets?: number;
  seconds?: number;
}

export interface IExerciseVersion {
  exerciseVersionId: string;
  exerciseId: string;
  title: string;
  description: string;
  tags: string[];
  mediaId?: string;
  defaultParams: IDefaultParams;
  createdByUserId: string;
  createdAt: Date;
}

type IExerciseVersionDoc = Omit<IExerciseVersion, 'exerciseVersionId'>;

export type ExerciseVersionDocument = HydratedDocument<IExerciseVersionDoc>;

const DefaultParamsSchema = new Schema<IDefaultParams>(
  {
    reps: { type: Number, min: 0 },
    sets: { type: Number, min: 0 },
    seconds: { type: Number, min: 0 },
  },
  { _id: false },
);

const ExerciseVersionSchema = new Schema<IExerciseVersionDoc>(
  {
    exerciseId: {
      type: String,
      required: true,
      ref: 'Exercise',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      required: true,
      default: [],
    },
    mediaId: {
      type: String,
      ref: 'Upload',
    },
    defaultParams: {
      type: DefaultParamsSchema,
      required: true,
      default: () => ({}),
    },
    createdByUserId: {
      type: String,
      required: true,
      ref: 'User',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['exerciseVersionId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

// exerciseId already has index: true on the field definition

export const ExerciseVersionModel: Model<IExerciseVersionDoc> =
  (mongoose.models['ExerciseVersion'] as Model<IExerciseVersionDoc>) ?? mongoose.model<IExerciseVersionDoc>('ExerciseVersion', ExerciseVersionSchema);
