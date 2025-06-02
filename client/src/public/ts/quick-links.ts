function checkQuickLink() {
  const QUICK_LINKS = ["replayID"];
  const parameters = new URLSearchParams(window.location.search);
  for (let parameter of QUICK_LINKS) {
    if (parameters.get(parameter)) {
      redirectScreen(parameter, parameters.get(parameter));
    }
  }
}

function redirectScreen(parameter: string, value: string | null) {
  if (!value) {
    return;
  }
  switch (parameter) {
    case "replay": {
      break;
    }
  }
}

export { checkQuickLink };
