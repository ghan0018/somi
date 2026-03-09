import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditMiddleware, createAuditEvent } from '../middleware/auditLog.js';
import { logger } from '../lib/logger.js';
import {
  listExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  archiveExercise,
  restoreExercise,
  initiateMediaUpload,
} from '../services/exercise.service.js';

export const exerciseRouter = Router();

// Read routes: any authenticated therapist or admin
const readAuth = [authenticate, authorize('therapist', 'admin')];
// Write routes: admin only (therapists have read-only access)
const writeAuth = [authenticate, authorize('admin')];

// ---------------------------------------------------------------------------
// GET /v1/exercises
// List exercises with optional text search, tag filtering, and pagination.
// ---------------------------------------------------------------------------
const listExercisesHandler: RequestHandler = async (req, res, next) => {
  try {
    const {
      q,
      tagIds: tagIdsRaw,
      archived,
      limit: limitRaw,
      cursor,
    } = req.query as Record<string, string | undefined>;

    const tagIds = tagIdsRaw
      ? tagIdsRaw.split(',').map((id) => id.trim()).filter(Boolean)
      : undefined;

    const limit = limitRaw != null ? parseInt(limitRaw, 10) : undefined;
    if (limit != null && (isNaN(limit) || limit <= 0)) {
      res.status(400).json({ message: 'limit must be a positive integer' });
      return;
    }

    const result = await listExercises({
      q: q?.trim(),
      tagIds,
      archived: archived === 'true',
      limit,
      cursor,
    });

    logger.info('Exercises listed', {
      correlationId: req.correlationId,
      userId: req.userId,
      count: result.items.length,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/exercises/:exerciseId
// Retrieve a single exercise with its full version history.
// ---------------------------------------------------------------------------
const getExerciseHandler: RequestHandler = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;

    const exercise = await getExerciseById(exerciseId);

    logger.info('Exercise fetched', {
      correlationId: req.correlationId,
      userId: req.userId,
      exerciseId,
    });

    res.status(200).json(exercise);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/exercises
// Create a new exercise (Exercise + initial ExerciseVersion).
// ---------------------------------------------------------------------------
const createExerciseHandler: RequestHandler = async (req, res, next) => {
  try {
    const { title, description, tagIds, defaultParams, mediaId } = req.body as {
      title?: string;
      description?: string;
      tagIds?: string[];
      defaultParams?: Record<string, number>;
      mediaId?: string;
    };

    const exercise = await createExercise({
      title: title ?? '',
      description: description ?? '',
      tagIds,
      defaultParams,
      mediaId,
      createdByUserId: req.userId!,
    });

    await createAuditEvent(req, {
      actionType: 'exercise.create',
      resourceType: 'exercise',
      resourceId: exercise.exerciseId,
    });

    logger.info('Exercise created', {
      correlationId: req.correlationId,
      userId: req.userId,
      exerciseId: exercise.exerciseId,
    });

    res.status(201).json(exercise);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /v1/exercises/:exerciseId
// Update an exercise — creates a new ExerciseVersion and bumps currentVersionId.
// ---------------------------------------------------------------------------
const updateExerciseHandler: RequestHandler = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const { title, description, tagIds, defaultParams, mediaId } = req.body as {
      title?: string;
      description?: string;
      tagIds?: string[];
      defaultParams?: Record<string, number>;
      mediaId?: string;
    };

    const exercise = await updateExercise(exerciseId, {
      title,
      description,
      tagIds,
      defaultParams,
      mediaId,
      updatedByUserId: req.userId!,
    });

    await createAuditEvent(req, {
      actionType: 'exercise.update',
      resourceType: 'exercise',
      resourceId: exercise.exerciseId,
    });

    logger.info('Exercise updated', {
      correlationId: req.correlationId,
      userId: req.userId,
      exerciseId,
      newVersionId: exercise.currentVersionId,
    });

    res.status(200).json(exercise);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/exercises/:exerciseId/archive
// Soft-delete: sets archivedAt timestamp.
// ---------------------------------------------------------------------------
const archiveExerciseHandler: RequestHandler = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;

    const exercise = await archiveExercise(exerciseId);

    await createAuditEvent(req, {
      actionType: 'exercise.archive',
      resourceType: 'exercise',
      resourceId: exerciseId,
    });

    logger.info('Exercise archived', {
      correlationId: req.correlationId,
      userId: req.userId,
      exerciseId,
    });

    res.status(200).json(exercise);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/exercises/:exerciseId/restore
// Restore a previously archived exercise.
// ---------------------------------------------------------------------------
const restoreExerciseHandler: RequestHandler = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;

    const exercise = await restoreExercise(exerciseId);

    await createAuditEvent(req, {
      actionType: 'exercise.update',
      resourceType: 'exercise',
      resourceId: exerciseId,
    });

    logger.info('Exercise restored', {
      correlationId: req.correlationId,
      userId: req.userId,
      exerciseId,
    });

    res.status(200).json(exercise);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/exercises/:exerciseId/media
// Initiate a pre-signed S3 upload for exercise media (MVP: mock URL).
// ---------------------------------------------------------------------------
const initiateMediaUploadHandler: RequestHandler = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const { contentType, sizeBytes } = req.body as {
      contentType?: string;
      sizeBytes?: number;
    };

    const result = await initiateMediaUpload(exerciseId, {
      contentType: contentType ?? '',
      sizeBytes: sizeBytes ?? 0,
    });

    logger.info('Media upload initiated', {
      correlationId: req.correlationId,
      userId: req.userId,
      exerciseId,
      mediaId: result.mediaId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

exerciseRouter.get(
  '/',
  ...readAuth,
  auditMiddleware('exercise.read', 'exercise'),
  listExercisesHandler,
);

exerciseRouter.get(
  '/:exerciseId',
  ...readAuth,
  auditMiddleware('exercise.read', 'exercise', { resourceIdParam: 'exerciseId' }),
  getExerciseHandler,
);

exerciseRouter.post(
  '/',
  ...writeAuth,
  createExerciseHandler,
);

exerciseRouter.patch(
  '/:exerciseId',
  ...writeAuth,
  updateExerciseHandler,
);

exerciseRouter.post(
  '/:exerciseId/archive',
  ...writeAuth,
  archiveExerciseHandler,
);

exerciseRouter.post(
  '/:exerciseId/restore',
  ...writeAuth,
  restoreExerciseHandler,
);

exerciseRouter.post(
  '/:exerciseId/media',
  ...writeAuth,
  initiateMediaUploadHandler,
);
