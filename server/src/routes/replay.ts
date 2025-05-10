import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
import { log } from "../core/log";
import {
  GameActionRecordInterface,
  GameActionRecord
} from "../models/GameActionRecord";
import ExpressMongoSanitize from "express-mongo-sanitize";
const router = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

router.get("/api/replay/:replayID", limiter, async (request, response) => {
  const replayID = request.params.replayID ?? "";

  if (!validateReplayID(replayID)) {
    response.status(400).json({ ok: false, reason: "Replay ID invalid." });
    return;
  }

  const sanitizedReplayID = ExpressMongoSanitize.sanitize(replayID as any);

  try {
    const data = await GameActionRecord.findOne({ _id: sanitizedReplayID });

    if (!data) {
      log.error(`Game recording ${sanitizedReplayID} doesn't exist.`);
      response.status(400).json({
        ok: false,
        reason: `Game recording ${sanitizedReplayID} doesn't exist.`
      });
      return;
    }

    const formattedData = await formatReplayData(data);
    return formattedData;
  } catch (error: unknown) {
    if (error instanceof Error) {
      log.error(`Error while getting game recording: ${error.stack}`);
    } else {
      log.error(`Error while getting game recording: ${error}`);
    }
    response.status(400).json({
      ok: false,
      reason: `Error while getting game recording: ${error}`
    });
    return;
  }
});

function validateReplayID(replayID: string) {
  const replayIDRegex = /^[0-9a-f]{24}$/;
  return replayIDRegex.test(replayID);
}

async function formatReplayData(data: GameActionRecordInterface) {
  const result = {
    ok: true,
    reason: "Successful",
    data: data
  };
  return result;
}
