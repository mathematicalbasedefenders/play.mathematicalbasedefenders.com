import express from "express";
const router = express.Router();
import rateLimit from "express-rate-limit";
import mongoDBSanitize from "express-mongo-sanitize";
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

import _ from "lodash";
import { log } from "../core/log";
import { User, UserInterface } from "../models/User";

const usernameRegex = /^[A-Za-z0-9_\-]{3,20}$/;
const userIDRegex = /^[0-9a-f]{24}$/;

/**
 * Returns if a query is in a correct format to go further.
 * @param query The query.
 * @returns true if the query is a valid username OR userID format (doesn't have to actually exist)
 */
function validateUserQuery(query: string) {
  const isValidUsername = usernameRegex.test(query);
  const isValidUserID = userIDRegex.test(query);
  return isValidUserID || isValidUsername;
}

async function getUserData(query: string) {
  return await User.findByUserIDUsingAPI(query);
}

router.get("/api/users/:user", limiter, async (request, response) => {
  // check if user is actually specified
  if (!request?.params?.user) {
    log.warn(`Invalid User Request: Missing user parameter.`);
    response.status(400).json({ error: "Missing user parameter for lookup." });
    return;
  }

  // get user data
  const user = request.params.user as unknown as Record<string, unknown>;
  const sanitized = mongoDBSanitize.sanitize(user) as unknown as string;

  if (!validateUserQuery(sanitized)) {
    log.warn(`Invalid User Request: Invalid user username/ID. (${sanitized})`);
    response.status(400).json({ error: "Invalid user parameter for lookup." });
    return;
  }

  // get data
  const data: UserInterface = await getUserData(sanitized);
  if (!data) {
    log.warn(`Invalid User Request: Unable to get user. (${sanitized})`);
    // has many reasons why
    response
      .status(400)
      .json("Invalid User Request: Unable to get user. (${sanitized})");
    return;
  }

  // send data
  response.status(200).json(data);
});

export { router };
