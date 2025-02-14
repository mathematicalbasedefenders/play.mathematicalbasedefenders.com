import fetch from "node-fetch";
import { calculateLevel, formatNumber, millisecondsToTime } from "./utilities";

function showUserLookupPopUp(userID: string) {
  $("#main-content__user-card-container").css("display", "flex");
  $("#user-card__data").hide(0);
  $("#user-card__error").hide(0);
  $("#user-card__loading").show(0);
  showUserLookupResults(userID);
}

async function showUserLookupResults(userID: string) {
  try {
    // get data
    const data = await getDataOfUserID(userID);
    const membership = getRankOfPlayer(data.membership);
    const level = calculateLevel(data.statistics.totalExperiencePoints);

    // show data
    // header
    $("#user-card__rank").text(membership.title);
    $("#user-card__rank").css("color", membership.color);
    $("#user-card__username").text(data.username);
    $("#user-card__username").css("color", membership.color);

    // level
    const levelPercentage = (level.progressToNext * 100).toFixed(3);
    const levelText = `Level ${level.level} (${levelPercentage}% to next)`;
    $("#user-card__level").text(levelText);

    // scores
    const easyPB = data.statistics.personalBestScoreOnEasySingleplayerMode;
    const standardPB = data.statistics.personalBestScoreOnEasySingleplayerMode;
    const multiplayerScore =
      data.statistics.multiplayer.gamesWon /
      data.statistics.multiplayer.gamesPlayed;

    $("#user-card__score--easy").text(easyPB.score.toLocaleString("en-US"));
    $("#user-card__score--standard").text(
      standardPB.score.toLocaleString("en-US")
    );
    $("#user-card__score--multiplier").text(
      `${(multiplayerScore * 100).toFixed(3)}%`
    );

    // detailed stats
    const easyStats = `${millisecondsToTime(
      easyPB.timeInMilliseconds
    )}, ${easyPB.enemiesKilled.toLocaleString("en-US")} killed`;
    const standardStats = `${millisecondsToTime(
      standardPB.timeInMilliseconds
    )}, ${standardPB.enemiesKilled.toLocaleString("en-US")} killed`;
    const multiplayerStats = `${data.statistics.multiplayer.gamesWon}/${data.statistics.multiplayer.gamesPlayed}`;

    $("#user-card__score--easy--detailed").text(easyStats);
    $("#user-card__score--standard--detailed").text(standardStats);
    $("#user-card__score--multiplayer--detailed").text(multiplayerStats);

    // open in new
    $(".user-card__open-in-new-button").off("click");
    $(".user-card__open-in-new-button").on("click", () => {
      // TODO: Un-hardcode me
      const url = `https://mathematicalbasedefenders.com/users/${data.username}`;
      window.open(url, "_blank");
    });

    // only if data is finished setting
    $("#user-card__error").hide(0);
    $("#user-card__loading").hide(0);
    $("#user-card__data").show(0);
  } catch (error) {
    // if error occurs, show error
    $("#user-card__data").hide(0);
    $("#user-card__loading").hide(0);
    $("#user-card__error").show(0);
    const message = `Error while fetching user data: ${error}`;
    $("#user-card__error__reason").text(message);
  }
}

async function getDataOfUserID(userID: string) {
  const data = await fetch(getURLToFetch(userID));
  const json = await data.json();
  return json;
}

function getURLToFetch(userID: string) {
  // if (process.env.CREDENTIAL_SET_USED === "TESTING") {
  //   return `http://localhost:4000/api/users/${userID}`;
  // } else {
  //   return `http://play.mathematicalbasedefenders:4000/api/users/${userID}`;
  // }
  const location = window.location;
  const host = `${location.protocol}//${location.hostname}:4000/api/users/${userID}`;
  return host;
}

function getRankOfPlayer(membership: { [key: string]: boolean }) {
  if (membership.isDeveloper) {
    return { title: "Developer", color: "#ff0000" };
  }
  if (membership.isAdministrator) {
    return { title: "Administrator", color: "#da1717" };
  }
  if (membership.isModerator) {
    return { title: "Moderator", color: "#ff7f00" };
  }
  if (membership.isContributor) {
    return { title: "Contributor", color: "#01acff" };
  }
  if (membership.isTester) {
    return { title: "Tester", color: "#5bb1e0" };
  }
  if (membership.isDonator) {
    return { title: "Donator", color: "#26e02c" };
  }
  // No rank
  return { title: "", color: "#ffffff" };
}

export { showUserLookupPopUp };
