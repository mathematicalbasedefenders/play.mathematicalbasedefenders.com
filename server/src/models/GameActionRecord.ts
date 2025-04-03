import mongoose, { ObjectId, SchemaTypes } from "mongoose";
import _ from "lodash";
import { ActionRecord } from "../replay/recording/ActionRecord";

interface GameActionRecordInterface {
  _id: ObjectId;
  data: Array<ActionRecord>;
  replayVersion: number;
  gameVersion: string;
  owner: ObjectId;
  name: string;
}

interface GameActionRecordModel
  extends mongoose.Model<GameActionRecordInterface> {}

const GameActionRecordSchema = new mongoose.Schema<
  GameActionRecordInterface,
  GameActionRecordModel
>({
  data: Array<ActionRecord>,
  replayVersion: Number,
  gameVersion: String,
  owner: SchemaTypes.ObjectId,
  name: String
});

const GameActionRecord = mongoose.model<
  GameActionRecordInterface,
  GameActionRecordModel
>("GameActionRecord", GameActionRecordSchema, "gameActionRecords");

export { GameActionRecord, GameActionRecordInterface };
