import mongoose, { ObjectId, SchemaTypes } from "mongoose";
import _ from "lodash";
import { ActionRecord } from "../replay/recording/ActionRecord";

interface GameActionRecordInterface {
  _id: ObjectId;
  actionRecords: Array<ActionRecord>;
  recordingVersion: number;
  gameVersion: string;
  owner: mongoose.Types.ObjectId | null | undefined;
  name: string;
  mode: string;
  timestamp: Date;
  statistics: {
    singleplayer?: {
      score: number;
      timeInMilliseconds: number;
      scoreSubmissionDateAndTime: Date;
      actionsPerformed: number;
      enemiesKilled: number;
      enemiesCreated: number;
    };
    multiplayer?: {
      ranking: any;
    };
  };
}

interface GameActionRecordModel
  extends mongoose.Model<GameActionRecordInterface> {}

const GameActionRecordSchema = new mongoose.Schema<
  GameActionRecordInterface,
  GameActionRecordModel
>(
  {
    actionRecords: Array<ActionRecord>,
    recordingVersion: Number,
    gameVersion: String,
    owner: SchemaTypes.ObjectId,
    name: String,
    mode: String,
    timestamp: Date,
    statistics: {
      singleplayer: {
        score: Number,
        timeInMilliseconds: Number,
        scoreSubmissionDateAndTime: Date,
        actionsPerformed: Number,
        enemiesKilled: Number,
        enemiesCreated: Number
      },
      multiplayer: {
        ranking: Array<any>
      }
    }
  },
  { timestamps: true }
);

const GameActionRecord = mongoose.model<
  GameActionRecordInterface,
  GameActionRecordModel
>("GameActionRecord", GameActionRecordSchema, "gameActionRecords");

export { GameActionRecord, GameActionRecordInterface, GameActionRecordModel };
