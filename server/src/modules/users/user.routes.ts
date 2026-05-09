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

userRouter.get('/me/dailies', async (req, res, next) => {
  try {
    const tasks = await userService.getDailyTasks(req.auth!.userId);
    res.status(200).json(tasks);
  } catch (error) {
    next(error);
  }
});

userRouter.get('/me/card-decks', async (req, res, next) => {
  try {
    const decks = await userService.listCardDecks(req.auth!.userId);
    res.status(200).json(decks);
  } catch (error) {
    next(error);
  }
});

userRouter.post('/me/card-decks/:deckId/purchase', async (req, res, next) => {
  try {
    const result = await userService.purchaseCardDeck(req.auth!.userId, String(req.params.deckId));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

userRouter.post('/me/card-decks/:deckId/select', async (req, res, next) => {
  try {
    const result = await userService.selectCardDeck(req.auth!.userId, String(req.params.deckId));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

userRouter.post('/me/dailies/:taskKey/claim', async (req, res, next) => {
  try {
    const result = await userService.claimDailyTask(req.auth!.userId, String(req.params.taskKey));
    res.status(200).json(result);
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
    const input: { username?: string; avatarUrl?: string | null } = {};

    if (req.body && 'username' in req.body) {
      input.username = req.body.username == null ? '' : String(req.body.username);
    }

    if (req.body && 'avatarUrl' in req.body) {
      input.avatarUrl = req.body.avatarUrl == null ? null : String(req.body.avatarUrl);
    }

    const user = await userService.updateProfile(req.auth!.userId, input);
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

userRouter.get('/admin/card-decks', adminMiddleware, async (_req, res, next) => {
  try {
    const decks = await userService.listAdminCardDecks();
    res.status(200).json(decks);
  } catch (error) {
    next(error);
  }
});

userRouter.post('/admin/card-decks/import', adminMiddleware, async (req, res, next) => {
  try {
    const deck = await userService.importAdminCardDeck(req.body);
    res.status(200).json(deck);
  } catch (error) {
    next(error);
  }
});
