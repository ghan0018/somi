import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface IExercise {
  exerciseId: string;
  currentVersionId: string;
  archivedAt?: Date;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

type IExerciseDoc = Omit<IExercise, 'exerciseId'>;

export type ExerciseDocument = HydratedDocument<IExerciseDoc>;

const ExerciseSchema = new Schema<IExerciseDoc>(
  {
    currentVersionId: {
      type: String,
      required: true,
      ref: 'ExerciseVersion',
    },
    archivedAt: {
      type: Date,
    },
    createdByUserId: {
      type: String,
      required: true,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['exerciseId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

export const ExerciseModel: Model<IExerciseDoc> = mongoose.model<IExerciseDoc>(
  'Exercise',
  ExerciseSchema,
);
