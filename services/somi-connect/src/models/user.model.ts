import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

/**
 * IUser represents the shape of a User document as returned by toJSON().
 * userId is the string representation of _id, added by the toJSON transform.
 */
export interface IUser {
  userId: string;
  role: 'client' | 'therapist' | 'admin';
  email: string;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  status: 'active' | 'disabled';
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Internal schema type omits the virtual userId alias
type IUserDoc = Omit<IUser, 'userId'>;

export type UserDocument = HydratedDocument<IUserDoc>;

const UserSchema = new Schema<IUserDoc>(
  {
    role: {
      type: String,
      enum: ['client', 'therapist', 'admin'],
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    mfaEnabled: {
      type: Boolean,
      required: true,
      default: false,
    },
    mfaSecret: {
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      required: true,
      default: 'active',
    },
    refreshTokenHash: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        const id = ret['_id'];
        ret['userId'] = id != null ? String(id) : undefined;
        delete ret['_id'];
        delete ret['__v'];
        delete ret['passwordHash'];
        delete ret['mfaSecret'];
        delete ret['refreshTokenHash'];
        return ret;
      },
    },
  },
);

export const UserModel: Model<IUserDoc> = (mongoose.models['User'] as Model<IUserDoc>) ?? mongoose.model<IUserDoc>('User', UserSchema);
