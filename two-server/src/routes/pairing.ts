import { Router, Request, Response } from 'express';
import { db } from '../db.js';

export const pairingRouter = Router();

// Create an ephemeral pairing rendezvous token
pairingRouter.post('/invite', async (req: Request, res: Response) => {
  try {
    const { spaceId, creatorId, creatorPublicKey, sealedKey } = req.body;
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();

    await db.createSpace(spaceId, creatorId, creatorPublicKey, sealedKey);
    db.rendezvousTokens.set(token, { spaceId, creatorPublicKey, sealedKey });

    res.json({ token, spaceId, creatorPublicKey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Joiner accepts invite and requests sealed space key
pairingRouter.post('/join', async (req: Request, res: Response) => {
  try {
    const { token, joinerId, joinerPublicKey, sealedSpaceKeyForJoiner } = req.body;
    const rendezvous = db.rendezvousTokens.get(token);

    if (!rendezvous) {
      return res.status(404).json({ error: 'Invite token expired or invalid' });
    }

    await db.addMemberToSpace(rendezvous.spaceId, joinerId, sealedSpaceKeyForJoiner);

    res.json({
      success: true,
      spaceId: rendezvous.spaceId,
      creatorPublicKey: rendezvous.creatorPublicKey
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
