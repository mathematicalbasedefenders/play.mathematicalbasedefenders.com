import fetch from "node-fetch";

function showUserLookupPopUp(userID: string) {
  const data = getDataOfUserID(userID);
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

export { showUserLookupPopUp };
