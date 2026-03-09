import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from './auth.routes.js';
import { exerciseRouter } from './exercise.routes.js';
import { patientRouter } from './patient.routes.js';
import { taxonomyRouter } from './taxonomy.routes.js';
import { uploadRouter } from './upload.routes.js';
import { planRouter } from './plan.routes.js';
import { clientPlanRouter } from './client-plan.routes.js';
import { completionRouter } from './completion.routes.js';
import { adherenceRouter } from './adherence.routes.js';
import { timelineRouter } from './timeline.routes.js';
import { messagingRouter } from './messaging.routes.js';
import { feedbackRouter } from './feedback.routes.js';
import { notesRouter } from './notes.routes.js';
import { adminRouter } from './admin.routes.js';

export const rootRouter = Router();

// Health check — mounted at root (outside /v1) so it is reachable without
// authentication and without the API version prefix (e.g. load-balancer probes).
rootRouter.use(healthRouter);

// ---------------------------------------------------------------------------
// /v1 API routes
// All authenticated, versioned routes are mounted here.
// ---------------------------------------------------------------------------
const v1Router = Router();

// Auth & current user
v1Router.use(authRouter);

// Exercise library
v1Router.use('/exercises', exerciseRouter);

// Patient management
v1Router.use('/clinic/patients', patientRouter);

// Taxonomy (tag library for exercises)
v1Router.use('/admin/taxonomy', taxonomyRouter);

// Uploads (pre-signed URL workflow)
v1Router.use('/uploads', uploadRouter);

// Treatment plans (therapist/admin)
v1Router.use('/clinic/patients', planRouter);

// Treatment plan (client-facing)
v1Router.use(clientPlanRouter);

// Completions — /me/today, /me/completions, /clinic/patients/:patientId/completions
v1Router.use(completionRouter);

// Adherence — /clinic/patients/:patientId/adherence/weekly|overall
v1Router.use('/clinic/patients', adherenceRouter);

// Timeline — /clinic/patients/:patientId/timeline
v1Router.use('/clinic/patients', timelineRouter);

// Messaging — /me/messages/thread, /messages/threads/:threadId/messages,
//             /clinic/patients/:patientId/messages/thread
v1Router.use(messagingRouter);

// Feedback — /clinic/patients/:patientId/feedback
v1Router.use('/clinic/patients', feedbackRouter);

// Notes — /clinic/patients/:patientId/notes (therapist/admin only, never client-facing)
v1Router.use('/clinic/patients', notesRouter);

// Admin — /admin/users, /admin/audit
v1Router.use('/admin', adminRouter);

rootRouter.use('/v1', v1Router);
