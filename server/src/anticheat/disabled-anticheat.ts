// Anticheat entry point

// Disabled for public view: always return true.
function performAnticheatCheck(...data: any[]) {
  return { ok: true };
}

export { performAnticheatCheck };
