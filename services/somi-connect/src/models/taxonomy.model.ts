import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export interface ITaxonomy {
  tagId: string;
  category: 'function' | 'structure' | 'age';
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

type ITaxonomyDoc = Omit<ITaxonomy, 'tagId'>;

export type TaxonomyDocument = HydratedDocument<ITaxonomyDoc>;

const TaxonomySchema = new Schema<ITaxonomyDoc>(
  {
    category: {
      type: String,
      enum: ['function', 'structure', 'age'],
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['tagId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  },
);

TaxonomySchema.index({ category: 1, label: 1 }, { unique: true });

export const TaxonomyModel: Model<ITaxonomyDoc> =
  (mongoose.models['Taxonomy'] as Model<ITaxonomyDoc>) ??
  mongoose.model<ITaxonomyDoc>('Taxonomy', TaxonomySchema);
