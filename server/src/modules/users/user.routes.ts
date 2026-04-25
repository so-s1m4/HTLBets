import { Router } from 'express';

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
