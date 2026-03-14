// ---------------------------------------------------------------------------
// Test Reset Endpoint
// Only available in non-production environments.
// Wipes test-relevant data and seeds a named scenario for E2E / mobile tests.
// ---------------------------------------------------------------------------

import { Router, RequestHandler } from 'express';
import { forbidden, badRequest } from '../lib/errors.js';
import { hashPassword, signAccessToken } from '../services/auth.service.js';
import { UserModel } from '../models/user.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { ExerciseModel } from '../models/exercise.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { TreatmentPlanModel } from '../models/treatment-plan.model.js';
import { CompletionEventModel } from '../models/completion-event.model.js';

export const testRouter = Router();

// ---------------------------------------------------------------------------
// POST /test/reset
// ---------------------------------------------------------------------------
const reset: RequestHandler = async (req, res, next) => {
  try {
    // Belt-and-suspenders: hard-fail if somehow reached in production
    if (process.env.NODE_ENV === 'production') {
      throw forbidden('Test endpoints are disabled in production');
    }

    // Verify X-Test-Secret header
    const testSecret =
      process.env.TEST_SECRET ??
      (process.env.NODE_ENV !== 'production' ? 'test-secret-dev' : undefined);

    const providedSecret = req.headers['x-test-secret'];
    if (!testSecret || providedSecret !== testSecret) {
      throw forbidden('Invalid or missing X-Test-Secret header');
    }

    const {
      scenario,
      patientEmail = 'patient@test-device.com',
      patientPassword = 'Password123!',
    } = req.body as {
      scenario?: string;
      patientEmail?: string;
      patientPassword?: string;
    };

    if (!scenario) {
      throw badRequest('scenario is required');
    }

    const validScenarios = [
      'today_view_single_round',
      'today_view_two_rounds',
      'today_view_all_complete',
      'no_plan',
      'login_only',
    ];
    if (!validScenarios.includes(scenario)) {
      throw badRequest(
        `Unknown scenario: ${scenario}. Valid scenarios: ${validScenarios.join(', ')}`,
      );
    }

    // -----------------------------------------------------------------------
    // Wipe existing test patient data (by email, to avoid nuking other users)
    // -----------------------------------------------------------------------
    const existingUser = await UserModel.findOne({ email: patientEmail });
    if (existingUser) {
      const existingPatient = await PatientProfileModel.findOne({
        userId: existingUser._id.toString(),
      });
      if (existingPatient) {
        const patientIdStr = existingPatient._id.toString();
        // Wipe completions and plans tied to this patient
        await CompletionEventModel.deleteMany({ patientId: patientIdStr });
        await TreatmentPlanModel.deleteMany({ patientId: patientIdStr });
        await PatientProfileModel.deleteOne({ _id: existingPatient._id });
      }
      await UserModel.deleteOne({ _id: existingUser._id });
    }

    // Wipe any leftover test exercises created by prior resets (keyed by title)
    const testExerciseTitles = ['Tongue Hold (Test)', 'Lip Seal (Test)'];
    const testVersions = await ExerciseVersionModel.find({
      title: { $in: testExerciseTitles },
    });
    const testExerciseIds = testVersions.map((v) => v.exerciseId);
    await ExerciseVersionModel.deleteMany({ title: { $in: testExerciseTitles } });
    await ExerciseModel.deleteMany({ _id: { $in: testExerciseIds } });

    // -----------------------------------------------------------------------
    // Create a seeder admin user (reuse if already exists)
    // -----------------------------------------------------------------------
    let seederAdmin = await UserModel.findOne({ email: 'seeder-admin@test-device.com' });
    if (!seederAdmin) {
      seederAdmin = await UserModel.create({
        email: 'seeder-admin@test-device.com',
        passwordHash: await hashPassword('Password123!'),
        role: 'admin',
        status: 'active',
        mfaEnabled: false,
      });
    }
    const seederAdminId = seederAdmin._id.toString();

    // -----------------------------------------------------------------------
    // Create patient user
    // -----------------------------------------------------------------------
    const passwordHash = await hashPassword(patientPassword);
    const patientUser = await UserModel.create({
      email: patientEmail,
      passwordHash,
      role: 'client',
      status: 'active',
      mfaEnabled: false,
    });
    const patientUserId = patientUser._id.toString();

    // Generate access token
    const accessToken = signAccessToken({ userId: patientUserId, role: 'client' });

    // login_only: no patient profile, no plan
    if (scenario === 'login_only') {
      res.status(200).json({
        patientId: null,
        accessToken,
        exerciseVersionIds: [],
        sessionKey: null,
        dateLocal: null,
      });
      return;
    }

    // -----------------------------------------------------------------------
    // Create patient profile (needed for all remaining scenarios)
    // -----------------------------------------------------------------------
    const patientProfile = await PatientProfileModel.create({
      userId: patientUserId,
      displayName: 'Test Patient',
      status: 'active',
      primaryTherapistId: seederAdminId,
      clinicId: 'default_clinic',
    });
    const patientId = patientProfile._id.toString();

    // no_plan: patient profile exists but no plan
    if (scenario === 'no_plan') {
      res.status(200).json({
        patientId,
        accessToken,
        exerciseVersionIds: [],
        sessionKey: null,
        dateLocal: null,
      });
      return;
    }

    // -----------------------------------------------------------------------
    // Create exercises (needed for plan scenarios)
    // -----------------------------------------------------------------------
    const ex1 = await ExerciseModel.create({
      currentVersionId: 'placeholder',
      createdByUserId: seederAdminId,
    });
    const ev1 = await ExerciseVersionModel.create({
      exerciseId: ex1._id.toString(),
      title: 'Tongue Hold (Test)',
      description: 'Hold tongue on palate',
      tags: [],
      defaultParams: { reps: 10, sets: 2 },
      createdByUserId: seederAdminId,
    });
    ex1.currentVersionId = ev1._id.toString();
    await ex1.save();
    const exercise1VersionId = ev1._id.toString();
    const exercise1Id = ex1._id.toString();

    const ex2 = await ExerciseModel.create({
      currentVersionId: 'placeholder',
      createdByUserId: seederAdminId,
    });
    const ev2 = await ExerciseVersionModel.create({
      exerciseId: ex2._id.toString(),
      title: 'Lip Seal (Test)',
      description: 'Close lips gently',
      tags: [],
      defaultParams: { seconds: 30 },
      createdByUserId: seederAdminId,
    });
    ex2.currentVersionId = ev2._id.toString();
    await ex2.save();
    const exercise2VersionId = ev2._id.toString();
    const exercise2Id = ex2._id.toString();

    // -----------------------------------------------------------------------
    // Determine timesPerDay from scenario
    // -----------------------------------------------------------------------
    const timesPerDay = scenario === 'today_view_two_rounds' ? 2 : 1;
    const sessionKey = 'sess_01';
    const dateLocal = new Date().toISOString().slice(0, 10); // today in UTC

    const plan = await TreatmentPlanModel.create({
      patientId,
      status: 'published',
      publishedAt: new Date(),
      publishedBy: seederAdminId,
      remindersEnabled: false,
      sessions: [
        {
          sessionKey,
          index: 0,
          title: 'Week 1',
          timesPerDay,
          assignments: [
            {
              assignmentKey: 'asgn_01',
              exerciseId: exercise1Id,
              exerciseVersionId: exercise1VersionId,
              index: 0,
            },
            {
              assignmentKey: 'asgn_02',
              exerciseId: exercise2Id,
              exerciseVersionId: exercise2VersionId,
              index: 1,
            },
          ],
        },
      ],
    });
    const planId = plan._id.toString();

    // -----------------------------------------------------------------------
    // Seed completions for today_view_all_complete
    // -----------------------------------------------------------------------
    if (scenario === 'today_view_all_complete') {
      // timesPerDay=1, 2 exercises -> 2 completions
      for (const [exerciseId, exerciseVersionId] of [
        [exercise1Id, exercise1VersionId],
        [exercise2Id, exercise2VersionId],
      ]) {
        await CompletionEventModel.create({
          patientId,
          planId,
          dateLocal,
          occurrence: 1,
          exerciseId,
          exerciseVersionId,
          completedAt: new Date(),
          source: 'mobile_ios',
        });
      }
    }

    res.status(200).json({
      patientId,
      accessToken,
      exerciseVersionIds: [exercise1VersionId, exercise2VersionId],
      sessionKey,
      dateLocal,
    });
  } catch (err) {
    next(err);
  }
};

testRouter.post('/reset', reset);
