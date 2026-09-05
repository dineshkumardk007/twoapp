import { Router, Request, Response } from 'express';
import { db, StoredRecord } from '../db.js';

export const syncRouter = Router();

// Push queued encrypted records from client
syncRouter.post('/push', async (req: Request, res: Response) => {
  try {
    const { records } = req.body as { records: StoredRecord[] };
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'Expected records array' });
    }

    const saved = [];
    for (const r of records) {
      const record = await db.saveRecord(r);
      saved.push(record.id);
    }

    res.json({ success: true, processedCount: saved.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pull delta records by Lamport clock
syncRouter.get('/pull/:spaceId', async (req: Request, res: Response) => {
  try {
    const spaceId = String(req.params.spaceId);
    const sinceLamport = parseInt(req.query.since as string || '0');

    const records = await db.getRecordsForSpace(spaceId, sinceLamport);
    res.json({ records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
