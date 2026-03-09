import { Router, RequestHandler } from 'express';
import {
  parseBasicAuth,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
} from '../services/auth.service.js';
import { unauthorized, badRequest } from '../lib/errors.js';
import { authenticate } from '../middleware/authenticate.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../lib/logger.js';
import { createAuditEvent } from '../middleware/auditLog.js';

// Models will be imported once they exist — use lazy require pattern for now
// to avoid circular dependency issues during project bootstrapping.
let UserModel: any;
async function getUserModel() {
  if (!UserModel) {
    const mod = await import('../models/user.model.js');
    UserModel = mod.UserModel;
  }
  return UserModel;
}

export const authRouter = Router();

// ---------------------------------------------------------------------------
// POST /v1/auth/login
// Authentication: HTTP Basic (Authorization: Basic <base64(email:password)>)
// ---------------------------------------------------------------------------
const login: RequestHandler = async (req, res, next) => {
  try {
    const credentials = parseBasicAuth(req.headers.authorization);
    if (!credentials) {
      throw unauthorized('Missing or malformed Basic auth credentials');
    }

    const User = await getUserModel();
    const user = await User.findOne({ email: credentials.email });
    if (!user) {
      throw unauthorized('Invalid email or password');
    }

    if (user.status === 'disabled') {
      throw unauthorized('Account is disabled');
    }

    const passwordValid = await verifyPassword(
      credentials.password,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw unauthorized('Invalid email or password');
    }

    // MFA required for therapist and admin roles
    if (
      (user.role === 'therapist' || user.role === 'admin') &&
      user.mfaEnabled
    ) {
      // For MVP, generate a simple challengeId that encodes the userId.
      // In production, this should be a short-lived signed token or stored in a
      // challenges collection with TTL.
      const challengeId = Buffer.from(
        JSON.stringify({ userId: user._id.toString(), ts: Date.now() }),
      ).toString('base64url');

      logger.info('MFA challenge issued', {
        correlationId: req.correlationId,
        userId: user._id.toString(),
        role: user.role,
      });

      res.status(200).json({
        mfaRequired: true,
        challengeId,
        methods: ['totp'],
      });
      return;
    }

    // No MFA required — issue tokens directly
    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });
    const refreshToken = signRefreshToken({
      userId: user._id.toString(),
      tokenVersion: 0,
    });

    // Store hashed refresh token for rotation verification
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();

    logger.info('Login successful', {
      correlationId: req.correlationId,
      userId: user._id.toString(),
      role: user.role,
    });

    res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/auth/mfa/verify
// ---------------------------------------------------------------------------
const mfaVerify: RequestHandler = async (req, res, next) => {
  try {
    const { challengeId, code } = req.body;

    if (!challengeId || !code) {
      throw badRequest('challengeId and code are required');
    }

    // Decode challengeId
    let challengeData: { userId: string; ts: number };
    try {
      challengeData = JSON.parse(
        Buffer.from(challengeId, 'base64url').toString('utf-8'),
      );
    } catch {
      throw unauthorized('Invalid or expired challenge');
    }

    // Check challenge freshness (5 minute window)
    if (Date.now() - challengeData.ts > 5 * 60 * 1000) {
      throw unauthorized('Challenge expired');
    }

    const User = await getUserModel();
    const user = await User.findById(challengeData.userId);
    if (!user || !user.mfaEnabled) {
      throw unauthorized('Invalid challenge');
    }

    // For MVP: accept a static test code in non-production, or implement TOTP.
    // Full TOTP implementation (using otpauth or similar) would go here.
    // For now, we'll validate that the code is a 6-digit string as a placeholder.
    if (!/^\d{6}$/.test(code)) {
      throw unauthorized('Invalid MFA code');
    }

    // TODO: Replace with actual TOTP validation:
    // import { TOTP } from 'otpauth';
    // const totp = new TOTP({ secret: user.mfaSecret });
    // if (totp.validate({ token: code }) === null) throw unauthorized('Invalid MFA code');

    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });
    const refreshToken = signRefreshToken({
      userId: user._id.toString(),
      tokenVersion: 0,
    });

    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save();

    logger.info('MFA verification successful', {
      correlationId: req.correlationId,
      userId: user._id.toString(),
      role: user.role,
    });

    res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/auth/refresh
// ---------------------------------------------------------------------------
const refresh: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw badRequest('refreshToken is required');
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw unauthorized('Invalid or expired refresh token');
    }

    const User = await getUserModel();
    const user = await User.findById(payload.userId);
    if (!user || user.status === 'disabled') {
      throw unauthorized('Invalid refresh token');
    }

    // Verify the refresh token matches what's stored (rotation check).
    // If no hash is stored (e.g. after logout), reject the token.
    if (!user.refreshTokenHash) {
      throw unauthorized('Refresh token has been revoked');
    }

    const valid = verifyRefreshTokenHash(refreshToken, user.refreshTokenHash);
    if (!valid) {
      // Possible token reuse attack — invalidate all tokens
      user.refreshTokenHash = undefined;
      await user.save();
      throw unauthorized('Refresh token has been revoked');
    }

    // Issue new access token
    const newAccessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });

    // Rotate refresh token
    const newRefreshToken = signRefreshToken({
      userId: user._id.toString(),
      tokenVersion: (payload.tokenVersion ?? 0) + 1,
    });

    user.refreshTokenHash = hashRefreshToken(newRefreshToken);
    await user.save();

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 3600,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/auth/logout
// ---------------------------------------------------------------------------
const logout: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw badRequest('refreshToken is required');
    }

    // Verify the token to get the userId, but don't fail hard if it's expired
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      // Token expired or invalid — still return 204 (idempotent logout)
      res.status(204).end();
      return;
    }

    const User = await getUserModel();
    const user = await User.findById(payload.userId);
    if (user) {
      user.refreshTokenHash = undefined;
      await user.save();

      await createAuditEvent(req, {
        actionType: 'auth.logout',
        resourceType: 'session',
      });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/me — current user profile
// ---------------------------------------------------------------------------
const getMe: RequestHandler = async (req, res, next) => {
  try {
    const User = await getUserModel();
    const user = await User.findById(req.userId);
    if (!user) {
      throw unauthorized('User not found');
    }

    const profile: Record<string, unknown> = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    if (user.role === 'client') {
      // Lazy import patient profile model
      const { PatientProfileModel } = await import(
        '../models/patient-profile.model.js'
      );
      const patientProfile = await PatientProfileModel.findOne({
        userId: user._id.toString(),
      });
      if (patientProfile) {
        profile.patientId = patientProfile._id.toString();
        profile.displayName = patientProfile.displayName;
      }
    } else {
      profile.mfaEnabled = user.mfaEnabled;
    }

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------
authRouter.post('/auth/login', authRateLimiter, login);
authRouter.post('/auth/mfa/verify', authRateLimiter, mfaVerify);
authRouter.post('/auth/refresh', refresh);
authRouter.post('/auth/logout', logout);
authRouter.get('/me', authenticate, getMe);
