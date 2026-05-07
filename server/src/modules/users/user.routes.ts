import { Router } from 'express';

import { adminMiddleware } from '../../middleware/admin.middleware';
import { authMiddleware } from '../../middleware/auth.middleware';
import { userService } from './user.service';

export const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/me', async (req, res, next) => {
  try {
    const user = await userService.getCurrentUser(req.auth!.userId);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

userRouter.get('/history', async (req, res, next) => {
  try {
    const history = await userService.getHistory(req.auth!.userId);
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
});

userRouter.get('/leaderboard', async (_req, res, next) => {
  try {
    const leaderboard = await userService.getLeaderboard();
    res.status(200).json(leaderboard);
  } catch (error) {
    next(error);
  }
});

userRouter.patch('/me/profile', async (req, res, next) => {
  try {
    const user = await userService.updateProfile(req.auth!.userId, {
      ...(req.body && 'username' in req.body ? { username: req.body.username } : {}),
      ...(req.body && 'avatarUrl' in req.body ? { avatarUrl: req.body.avatarUrl } : {})
    });
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

userRouter.get('/admin/users', adminMiddleware, async (_req, res, next) => {
  try {
    const users = await userService.listUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
});

userRouter.get('/admin/users/:userId/history', adminMiddleware, async (req, res, next) => {
  try {
    const history = await userService.getUserHistory(String(req.params.userId));
    res.status(200).json(history);
  } catch (error) {
    next(error);
  }
});

userRouter.patch('/admin/users/:userId/balance', adminMiddleware, async (req, res, next) => {
  try {
    const user = await userService.setBalance(req.auth!.userId, String(req.params.userId), req.body?.balance);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});
