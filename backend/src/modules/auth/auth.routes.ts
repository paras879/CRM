import { Router } from 'express';
import * as authController from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { rateLimit } from '../../middleware/rate-limiter.js';
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema.js';

const router = Router();

// Rate limit login attempts: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many authentication attempts. Please try again after 15 minutes.',
});

router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.getMe);
router.get('/csrf', authController.getCsrf);
router.post(
  '/forgot-password',
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);

export const authRouter = router;
