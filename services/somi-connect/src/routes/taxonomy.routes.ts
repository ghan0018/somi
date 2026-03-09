import { Router, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createAuditEvent } from '../middleware/auditLog.js';
import { TaxonomyModel } from '../models/taxonomy.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { badRequest, notFound, conflict } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const taxonomyRouter = Router();

// Shared middleware stacks
const authReadOnly = [authenticate, authorize('therapist', 'admin')];
const authAdminOnly = [authenticate, authorize('admin')];

// ---------------------------------------------------------------------------
// GET /v1/admin/taxonomy
// List all taxonomy tags (function, structure, age). Non-PHI — no audit needed.
// ---------------------------------------------------------------------------
const listTagsHandler: RequestHandler = async (req, res, next) => {
  try {
    const docs = await TaxonomyModel.find().sort({ category: 1, label: 1 }).lean();

    // Find which tags are currently used by exercise versions
    const usedTagIds = await ExerciseVersionModel.distinct('tags');
    const usedTagSet = new Set(usedTagIds.map(String));

    const items = docs.map((doc) => ({
      tagId: String(doc._id),
      category: doc.category,
      label: doc.label,
      inUse: usedTagSet.has(String(doc._id)),
    }));

    logger.info('Taxonomy tags listed', {
      correlationId: req.correlationId,
      userId: req.userId,
      count: items.length,
    });

    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/admin/taxonomy
// Create a new taxonomy tag (admin only).
// ---------------------------------------------------------------------------
const createTagHandler: RequestHandler = async (req, res, next) => {
  try {
    const { category, label } = req.body as {
      category?: unknown;
      label?: unknown;
    };

    // Validate category
    const validCategories = ['function', 'structure', 'age'] as const;
    if (
      !category ||
      !validCategories.includes(category as (typeof validCategories)[number])
    ) {
      throw badRequest('category must be one of: function, structure, age', {
        category,
        allowed: [...validCategories],
      });
    }

    // Validate label
    if (!label || typeof label !== 'string' || !label.trim()) {
      throw badRequest('label is required and must be a non-empty string');
    }

    const trimmedLabel = label.trim();

    // Persist — let Mongoose/MongoDB surface the unique-index violation
    let doc;
    try {
      doc = await TaxonomyModel.create({
        category,
        label: trimmedLabel,
      });
    } catch (err: unknown) {
      // MongoDB duplicate key error code (11000 is stored as a number on the error object)
      if (
        err instanceof Error &&
        'code' in err &&
        (err as Error & { code: unknown }).code === 11000
      ) {
        throw conflict(
          `Tag with category '${category}' and label '${trimmedLabel}' already exists`,
        );
      }
      throw err;
    }

    const tag = doc.toJSON() as Record<string, unknown>;

    logger.info('Taxonomy tag created', {
      correlationId: req.correlationId,
      userId: req.userId,
      tagId: tag['tagId'],
      category,
      label: trimmedLabel,
    });

    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// DELETE /v1/admin/taxonomy/:tagId
// Remove a taxonomy tag (admin only). Existing exercise references are kept.
// ---------------------------------------------------------------------------
const deleteTagHandler: RequestHandler = async (req, res, next) => {
  try {
    const { tagId } = req.params;

    let objectId: mongoose.Types.ObjectId;
    try {
      objectId = new mongoose.Types.ObjectId(tagId);
    } catch {
      throw notFound(`Taxonomy tag '${tagId}' not found`);
    }

    // Check if tag is used by any exercise versions
    const usageCount = await ExerciseVersionModel.countDocuments({ tags: tagId });
    if (usageCount > 0) {
      throw conflict(`Cannot delete: tag is used by ${usageCount} exercise(s)`);
    }

    const deleted = await TaxonomyModel.findByIdAndDelete(objectId);
    if (!deleted) {
      throw notFound(`Taxonomy tag '${tagId}' not found`);
    }

    await createAuditEvent(req, {
      actionType: 'admin.audit_read', // closest available action type for admin mutations
      resourceType: 'taxonomy',
      resourceId: tagId,
    });

    logger.info('Taxonomy tag deleted', {
      correlationId: req.correlationId,
      userId: req.userId,
      tagId,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

taxonomyRouter.get('/', ...authReadOnly, listTagsHandler);

taxonomyRouter.post('/', ...authAdminOnly, createTagHandler);

taxonomyRouter.delete('/:tagId', ...authAdminOnly, deleteTagHandler);
