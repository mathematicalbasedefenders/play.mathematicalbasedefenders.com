import fetch from "node-fetch";

async function getDataOfUserID(userID: string) {
  alert(`Finding data for userID ${userID}`);
  const data = await fetch(getURLToFetch(userID));
  const json = await data.json();
  alert(`${JSON.stringify(json)}`);
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

export { getDataOfUserID };
