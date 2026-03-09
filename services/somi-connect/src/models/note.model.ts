import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

/**
 * CRITICAL: Notes are therapist-only PHI.
 * They must NEVER be returned to clients.
 * All access control enforcement must be applied at the route/service layer.
 */
export interface INote {
  noteId: string;
  patientId: string;
  authorUserId: string;
  /** PHI — therapist-only */
  noteText: string;
  planId?: string;
  sessionKey?: string;
  createdAt: Date;
}

type INoteDoc = Omit<INote, 'noteId'>;

export type NoteDocument = HydratedDocument<INoteDoc>;

const NoteSchema = new Schema<INoteDoc>(
  {
    patientId: {
      type: String,
      required: true,
      ref: 'PatientProfile',
    },
    authorUserId: {
      type: String,
      required: true,
      ref: 'User',
    },
    noteText: {
      type: String,
      required: true,
    },
    planId: {
      type: String,
      ref: 'TreatmentPlan',
    },
    sessionKey: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['noteId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

NoteSchema.index({ patientId: 1, createdAt: 1 });

export const NoteModel: Model<INoteDoc> = mongoose.model<INoteDoc>('Note', NoteSchema);
