function updateSystemStatusTrayText(data: { [key: string]: any }) {
  if (data.osUsageLevel == 2) {
    $("#status-indicators--os").css("color", "#ff0000");
    $("#status-indicators--os").text(
      `OS: ${Math.round(data.osUsageToShow * 100)}%`
    );
  } else if (data.osUsageLevel == 1) {
    $("#status-indicators--os").css("color", "#ff6200");
    $("#status-indicators--os").text(
      `OS: ${Math.round(data.osUsageToShow * 100)}%`
    );
  } else {
    $("#status-indicators--os").css("color", "#000000");
    $("#status-indicators--os").text("");
  }

  if (data.updateTimeLevel == 2) {
    $("#status-indicators--update-time").css("color", "#ff0000");
    $("#status-indicators--update-time").text(
      `UT: ${Math.round(data.updateTimeToShow)}ms`
    );
  } else if (data.updateTimeLevel == 1) {
    $("#status-indicators--update-time").css("color", "#ff6200");
    $("#status-indicators--update-time").text(
      `UT: ${Math.round(data.updateTimeToShow)}ms`
    );
  } else {
    $("#status-indicators--update-time").css("color", "#000000");
    $("#status-indicators--update-time").text("");
  }
}
export { updateSystemStatusTrayText };
