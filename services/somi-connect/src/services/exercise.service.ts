import mongoose from 'mongoose';
import { ExerciseModel } from '../models/exercise.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { TaxonomyModel } from '../models/taxonomy.model.js';
import { badRequest, notFound, unprocessable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { IDefaultParams } from '../models/exercise-version.model.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagRef {
  tagId: string;
  label: string;
}

export interface ExerciseListItem {
  exerciseId: string;
  currentVersionId: string;
  title: string;
  description: string;
  tags: TagRef[];
  mediaId?: string;
  defaultParams: IDefaultParams;
  archivedAt: Date | null;
  createdAt: Date;
}

export interface ExerciseDetail extends ExerciseListItem {
  versions: { exerciseVersionId: string; createdAt: Date }[];
  updatedAt: Date;
}

export interface ListExercisesParams {
  q?: string;
  tagIds?: string[];
  archived?: boolean;
  limit?: number;
  cursor?: string;
}

export interface CreateExerciseParams {
  title: string;
  description: string;
  tagIds?: string[];
  defaultParams?: IDefaultParams;
  mediaId?: string;
  createdByUserId: string;
}

export interface UpdateExerciseParams {
  title?: string;
  description?: string;
  tagIds?: string[];
  defaultParams?: IDefaultParams;
  mediaId?: string;
  updatedByUserId: string;
}

export interface InitiateMediaUploadParams {
  contentType: string;
  sizeBytes: number;
}

export interface MediaUploadResult {
  mediaId: string;
  uploadUrl: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

function decodeCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    throw badRequest('Invalid pagination cursor');
  }
}

function encodeCursor(id: unknown): string {
  return Buffer.from(String(id)).toString('base64');
}

/**
 * Resolve tag IDs to { tagId, label } objects from Taxonomy.
 * Tags not found in taxonomy are silently dropped so stale IDs
 * do not hard-fail the request.
 */
async function resolveTags(tagIds: string[]): Promise<TagRef[]> {
  if (!tagIds.length) return [];

  const docs = await TaxonomyModel.find({
    _id: { $in: tagIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).lean();

  return docs.map((doc) => ({
    tagId: String(doc._id),
    label: doc.label,
  }));
}

/**
 * Build a plain ExerciseListItem from an Exercise doc and its current version.
 */
async function buildExerciseListItem(
  exerciseDoc: InstanceType<typeof ExerciseModel>,
  versionDoc: InstanceType<typeof ExerciseVersionModel>,
): Promise<ExerciseListItem> {
  const tags = await resolveTags(versionDoc.tags ?? []);

  return {
    exerciseId: String(exerciseDoc._id),
    currentVersionId: String(versionDoc._id),
    title: versionDoc.title,
    description: versionDoc.description,
    tags,
    mediaId: versionDoc.mediaId,
    defaultParams: versionDoc.defaultParams ?? {},
    archivedAt: exerciseDoc.archivedAt ?? null,
    createdAt: exerciseDoc.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * List exercises with optional text search, tag filtering, and cursor pagination.
 */
export async function listExercises(
  params: ListExercisesParams,
): Promise<{ items: ExerciseListItem[]; nextCursor: string | null }> {
  const limit = Math.min(
    params.limit != null ? params.limit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  // -------------------------------------------------------------------------
  // Step 1: Determine which exerciseIds match text/tag filters (if any).
  // We always query ExerciseVersion for these since title/description/tags
  // live on the version document.
  // -------------------------------------------------------------------------
  let filteredExerciseIds: string[] | null = null;

  const hasTextFilter = Boolean(params.q?.trim());
  const hasTagFilter = Boolean(params.tagIds?.length);

  if (hasTextFilter || hasTagFilter) {
    const versionQuery: Record<string, unknown> = {};

    if (hasTextFilter) {
      const pattern = new RegExp(params.q!.trim(), 'i');
      versionQuery['$or'] = [{ title: pattern }, { description: pattern }];
    }

    if (hasTagFilter) {
      versionQuery['tags'] = { $all: params.tagIds };
    }

    // Fetch matching version docs (only the exerciseId field needed)
    const matchingVersions = await ExerciseVersionModel.find(versionQuery)
      .select('exerciseId')
      .lean();

    filteredExerciseIds = [
      ...new Set(matchingVersions.map((v) => v.exerciseId)),
    ];

    // Short-circuit if no versions matched the filters
    if (!filteredExerciseIds.length) {
      return { items: [], nextCursor: null };
    }
  }

  // -------------------------------------------------------------------------
  // Step 2: Query Exercise collection with pagination + archived filter.
  // -------------------------------------------------------------------------
  const exerciseQuery: Record<string, unknown> = {};

  if (!params.archived) {
    exerciseQuery['archivedAt'] = { $exists: false };
  }

  if (filteredExerciseIds !== null) {
    exerciseQuery['_id'] = { $in: filteredExerciseIds };
  }

  if (params.cursor) {
    const decodedId = decodeCursor(params.cursor);
    // Merge with any existing _id filter
    if (exerciseQuery['_id']) {
      exerciseQuery['_id'] = {
        ...(exerciseQuery['_id'] as object),
        $gt: decodedId,
      };
    } else {
      exerciseQuery['_id'] = { $gt: decodedId };
    }
  }

  // Fetch one extra to detect if there is a next page
  const exerciseDocs = await ExerciseModel.find(exerciseQuery)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean({ virtuals: false });

  const hasMore = exerciseDocs.length > limit;
  const page = hasMore ? exerciseDocs.slice(0, limit) : exerciseDocs;

  // -------------------------------------------------------------------------
  // Step 3: Bulk-fetch current versions for this page.
  // -------------------------------------------------------------------------
  const versionIds = page.map((e) => e.currentVersionId);
  const versionDocs = await ExerciseVersionModel.find({
    _id: { $in: versionIds },
  }).lean({ virtuals: false });

  const versionMap = new Map<string, (typeof versionDocs)[0]>();
  for (const v of versionDocs) {
    versionMap.set(String(v._id), v);
  }

  // -------------------------------------------------------------------------
  // Step 4: Collect all unique tagIds across this page for bulk tag resolution.
  // -------------------------------------------------------------------------
  const allTagIds = new Set<string>();
  for (const e of page) {
    const v = versionMap.get(String(e.currentVersionId));
    if (v?.tags) {
      for (const t of v.tags) allTagIds.add(t);
    }
  }

  const tagLookup = new Map<string, string>();
  if (allTagIds.size > 0) {
    const taxonomyDocs = await TaxonomyModel.find({
      _id: { $in: [...allTagIds].map((id) => new mongoose.Types.ObjectId(id)) },
    }).lean();
    for (const doc of taxonomyDocs) {
      tagLookup.set(String(doc._id), doc.label);
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Assemble response items.
  // -------------------------------------------------------------------------
  const items: ExerciseListItem[] = page.map((exerciseDoc) => {
    const version = versionMap.get(String(exerciseDoc.currentVersionId));
    const tags: TagRef[] = (version?.tags ?? [])
      .filter((id) => tagLookup.has(id))
      .map((id) => ({ tagId: id, label: tagLookup.get(id)! }));

    return {
      exerciseId: String(exerciseDoc._id),
      currentVersionId: String(exerciseDoc.currentVersionId),
      title: version?.title ?? '',
      description: version?.description ?? '',
      tags,
      mediaId: version?.mediaId,
      defaultParams: version?.defaultParams ?? {},
      archivedAt: exerciseDoc.archivedAt ?? null,
      createdAt: exerciseDoc.createdAt,
    };
  });

  const nextCursor = hasMore
    ? encodeCursor(page[page.length - 1]._id)
    : null;

  return { items, nextCursor };
}

/**
 * Get a single exercise by exerciseId, including full version history.
 */
export async function getExerciseById(
  exerciseId: string,
): Promise<ExerciseDetail> {
  const exerciseDoc = await ExerciseModel.findById(exerciseId).lean();
  if (!exerciseDoc) {
    throw notFound(`Exercise '${exerciseId}' not found`);
  }

  const currentVersion = await ExerciseVersionModel.findById(
    exerciseDoc.currentVersionId,
  ).lean();
  if (!currentVersion) {
    logger.warn('Exercise has no current version document', {
      exerciseId,
      currentVersionId: exerciseDoc.currentVersionId,
    });
    throw notFound(`Exercise version for '${exerciseId}' not found`);
  }

  // Fetch all versions for this exercise, newest first
  const allVersions = await ExerciseVersionModel.find({ exerciseId })
    .select('_id createdAt')
    .sort({ createdAt: -1 })
    .lean();

  // Resolve tags
  const tagIds = currentVersion.tags ?? [];
  let tags: TagRef[] = [];
  if (tagIds.length) {
    const taxonomyDocs = await TaxonomyModel.find({
      _id: { $in: tagIds.map((id) => new mongoose.Types.ObjectId(id)) },
    }).lean();
    const tagLookup = new Map(taxonomyDocs.map((d) => [String(d._id), d.label]));
    tags = tagIds
      .filter((id) => tagLookup.has(id))
      .map((id) => ({ tagId: id, label: tagLookup.get(id)! }));
  }

  return {
    exerciseId: String(exerciseDoc._id),
    currentVersionId: String(exerciseDoc.currentVersionId),
    title: currentVersion.title,
    description: currentVersion.description,
    tags,
    mediaId: currentVersion.mediaId,
    defaultParams: currentVersion.defaultParams ?? {},
    archivedAt: exerciseDoc.archivedAt ?? null,
    versions: allVersions.map((v) => ({
      exerciseVersionId: String(v._id),
      createdAt: v.createdAt,
    })),
    createdAt: exerciseDoc.createdAt,
    updatedAt: exerciseDoc.updatedAt,
  };
}

/**
 * Create a new exercise with an initial ExerciseVersion.
 */
export async function createExercise(
  params: CreateExerciseParams,
): Promise<ExerciseDetail> {
  const { title, description, tagIds = [], defaultParams = {}, mediaId, createdByUserId } = params;

  if (!title?.trim()) {
    throw badRequest('title is required');
  }
  if (!description?.trim()) {
    throw badRequest('description is required');
  }

  // Create parent Exercise with placeholder version
  const exerciseDoc = await ExerciseModel.create({
    currentVersionId: 'placeholder',
    createdByUserId,
  });
  const exerciseId = String(exerciseDoc._id);

  let versionId: string;
  try {
    // Create the initial ExerciseVersion
    const versionDoc = await ExerciseVersionModel.create({
      exerciseId,
      title: title.trim(),
      description: description.trim(),
      tags: tagIds,
      defaultParams,
      mediaId,
      createdByUserId,
    });
    versionId = String(versionDoc._id);
  } catch (err) {
    // Clean up orphaned Exercise if version creation fails
    await ExerciseModel.findByIdAndDelete(exerciseId);
    throw err;
  }

  // Point Exercise at the real version
  await ExerciseModel.findByIdAndUpdate(exerciseId, { currentVersionId: versionId });

  logger.info('Exercise created', { exerciseId, versionId });

  return getExerciseById(exerciseId);
}

/**
 * Update an exercise by creating a new ExerciseVersion and pointing
 * currentVersionId at it.
 */
export async function updateExercise(
  exerciseId: string,
  params: UpdateExerciseParams,
): Promise<ExerciseDetail> {
  const { updatedByUserId, ...fields } = params;

  const exerciseDoc = await ExerciseModel.findById(exerciseId);
  if (!exerciseDoc) {
    throw notFound(`Exercise '${exerciseId}' not found`);
  }

  // Load current version to inherit unchanged fields
  const currentVersion = await ExerciseVersionModel.findById(
    exerciseDoc.currentVersionId,
  ).lean();
  if (!currentVersion) {
    throw unprocessable(
      `Exercise '${exerciseId}' is missing its current version document`,
    );
  }

  const newTitle =
    fields.title !== undefined ? fields.title.trim() : currentVersion.title;
  const newDescription =
    fields.description !== undefined
      ? fields.description.trim()
      : currentVersion.description;
  const newTagIds =
    fields.tagIds !== undefined ? fields.tagIds : currentVersion.tags;
  const newDefaultParams =
    fields.defaultParams !== undefined
      ? fields.defaultParams
      : currentVersion.defaultParams;
  const newMediaId =
    fields.mediaId !== undefined ? fields.mediaId : currentVersion.mediaId;

  if (!newTitle) {
    throw badRequest('title cannot be empty');
  }
  if (!newDescription) {
    throw badRequest('description cannot be empty');
  }

  const newVersion = await ExerciseVersionModel.create({
    exerciseId,
    title: newTitle,
    description: newDescription,
    tags: newTagIds,
    defaultParams: newDefaultParams,
    mediaId: newMediaId,
    createdByUserId: updatedByUserId,
  });

  const newVersionId = String(newVersion._id);

  exerciseDoc.currentVersionId = newVersionId;
  await exerciseDoc.save();

  // TODO (Milestone 3): Propagate new versionId to all draft and published
  // treatment plan assignments that reference this exerciseId.

  logger.info('Exercise updated — new version created', {
    exerciseId,
    newVersionId,
  });

  return getExerciseById(exerciseId);
}

/**
 * Soft-delete: set archivedAt timestamp.
 */
export async function archiveExercise(
  exerciseId: string,
): Promise<ExerciseDetail> {
  const exerciseDoc = await ExerciseModel.findById(exerciseId);
  if (!exerciseDoc) {
    throw notFound(`Exercise '${exerciseId}' not found`);
  }

  if (exerciseDoc.archivedAt) {
    throw badRequest(`Exercise '${exerciseId}' is already archived`);
  }

  exerciseDoc.archivedAt = new Date();
  await exerciseDoc.save();

  logger.info('Exercise archived', { exerciseId });

  return getExerciseById(exerciseId);
}

/**
 * Restore a previously archived exercise.
 */
export async function restoreExercise(
  exerciseId: string,
): Promise<ExerciseDetail> {
  const exerciseDoc = await ExerciseModel.findById(exerciseId);
  if (!exerciseDoc) {
    throw notFound(`Exercise '${exerciseId}' not found`);
  }

  if (!exerciseDoc.archivedAt) {
    throw badRequest(`Exercise '${exerciseId}' is not archived`);
  }

  exerciseDoc.archivedAt = undefined;
  await exerciseDoc.save();

  logger.info('Exercise restored', { exerciseId });

  return getExerciseById(exerciseId);
}

/**
 * Initiate a pre-signed S3 upload for exercise media.
 * For MVP, returns a mock upload URL.
 */
export async function initiateMediaUpload(
  exerciseId: string,
  params: InitiateMediaUploadParams,
): Promise<MediaUploadResult> {
  const exerciseDoc = await ExerciseModel.findById(exerciseId).lean();
  if (!exerciseDoc) {
    throw notFound(`Exercise '${exerciseId}' not found`);
  }

  const { contentType, sizeBytes } = params;

  if (!contentType?.trim()) {
    throw badRequest('contentType is required');
  }
  if (!sizeBytes || sizeBytes <= 0) {
    throw badRequest('sizeBytes must be a positive number');
  }

  // TODO (Milestone 2): Replace with real S3 pre-signed URL generation:
  //   const command = new PutObjectCommand({ Bucket, Key, ContentType });
  //   const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  const mediaId = `lib_media_${new mongoose.Types.ObjectId().toString()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const uploadUrl = `https://mock-s3.example.com/exercise-media/${exerciseId}/${mediaId}?ContentType=${encodeURIComponent(contentType)}&Expires=${expiresAt}`;

  logger.info('Media upload initiated (mock)', { exerciseId, mediaId, contentType, sizeBytes });

  return { mediaId, uploadUrl, expiresAt };
}
