import { changeScreen } from "./game";

function checkQuickLink() {
  const QUICK_LINKS = ["replayID"];
  const parameters = new URLSearchParams(window.location.search);
  for (let parameter of QUICK_LINKS) {
    if (parameters.get(parameter)) {
      activateLink(parameter, parameters.get(parameter));
    }
  }
}

function activateLink(parameter: string, value: string | null) {
  if (!value) {
    return;
  }
  console.log(`Activating click link ${parameter}:${value}`);
  switch (parameter) {
    case "replay": {
      const REPLAY_REGEX = /[0-9a-f]{24}/;
      if (!REPLAY_REGEX.test(value)) {
        break;
      }
      redirectToReplay(value);
      break;
    }
  }
}

function redirectToReplay(replayID: string) {
  changeScreen("archiveMenu");
  $("#archive__replay-id").val(replayID);
  $("#archive__search-button").trigger("click");
}

export { checkQuickLink };
