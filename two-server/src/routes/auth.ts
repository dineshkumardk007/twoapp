import { Router, Request, Response } from 'express';
import { db } from '../db.js';

export const authRouter = Router();

// Register user with identity public key and master-key-wrapped private key
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { id, authId, publicKey, encryptedPrivateKey } = req.body;
    if (!id || !authId || !publicKey || !encryptedPrivateKey) {
      return res.status(400).json({ error: 'Missing required cryptographic fields' });
    }

    const existing = await db.findUserByAuthId(authId);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = await db.createUser({
      id,
      authId,
      publicKey,
      encryptedPrivateKey
    });

    res.status(201).json({ user: { id: user.id, authId: user.authId, publicKey: user.publicKey } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch user's public key (for partner key verification)
authRouter.get('/user/:id', async (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const user = await db.findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    id: user.id,
    publicKey: user.publicKey,
    encryptedPrivateKey: user.encryptedPrivateKey
  });
});
