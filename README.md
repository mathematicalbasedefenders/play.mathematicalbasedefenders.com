# play.mathematicalbasedefenders.com
[![CodeFactor](https://www.codefactor.io/repository/github/mathematicalbasedefenders/play.mathematicalbasedefenders.com/badge)](https://www.codefactor.io/repository/github/mathematicalbasedefenders/play.mathematicalbasedefenders.com)
<img src="https://img.shields.io/badge/dynamic/json?label=Registered Users on Official Server&query=usersRegistered&url=https%3A%2F%2Fmathematicalbasedefenders.com%2Fapi%2Fmetadata">

Mathematical Base Defenders is a multiplayer math game where the objective is simple: solve problems on the enemies to kill them.

This is the `play` subdomain, where the actual game content is located.

## Gameplay
Here is an excerpt from [`https://mathematicalbasedefenders.com/about`](https://mathematicalbasedefenders.com/about), which mistertfy64 believes gives the basic idea of the game well:
> Enemies will fall from the top to your "base". Each enemy has text which is either a number or a math problem.
> Your objective is to type the number or solve those math problems before the enemies come and reach your "base" (the line).
> If an enemy has the text `10`, you must type `10` and submit the problem to kill the enemy.
> If an enemy has the text `3 + 4`, you must type `7` and submit the problem to kill the enemy. (`3 + 4 = 7`)
> For each enemy you missed (i.e., for each enemy that reached the base), you will lose base health. If your base health is 0, the game is over.

Also see the [Screenshots](https://github.com/mathematicalbasedefenders/play.mathematicalbasedefenders.com?tab=readme-ov-file#screenshots) section to get a better idea.

## Features
- Multiple game modes:
  - Standard Singleplayer
  - Easy Singleplayer
  - Custom Singleplayer
  - Default Multiplayer (Custom Multiplayer is planned for the future.)
- Account System
- Leaderboards
- Customizable Game Client
  - Able to set width of enemies
  - Able to set what symbol to use for the multiplication sign

## Screenshots
These screenshots are from version `0.4.3`.

<img src="https://storage.mistertfy64.com/playmbd-screenshots/gameplay.png" height="360" alt="A screenshot of a Standard Singleplayer game.">
<img src="https://storage.mistertfy64.com/playmbd-screenshots/main-menu.png" height="360" alt="A screenshot of the main menu.">

## Usage on Other Servers

Because this is open-source, you are free to use it on your own servers/domains. Feel free to modify the (horrible) source code, add your own modifications, and share!

However, please note that while this only covers the `play` subdomain, meaning if you want to have accounts on your own servers, you might have to hardcode it.

Note: As of May 29, 2024, this source code has been exclusively made for Mathematical Base Defenders's official server (e.g. hardcoded strings that only work with the official server) and `localhost`. So if you are planning to use this in your own server (or domain), it might not work (You can still run it on localhost, this doesn't mean you can't run it on a different domain, you can, you just have to find the hardcoded strings). This will be fixed sometime later.

Finally, please note that if the Game Master decides to do something stupid (e.g. host an 2x exp event), it will only be on the official server. Likewise, if you want to host your own event, it will only be on your server.

## Contributing
If you instead want to contribute to the official server, feel free to open an issue/pull request!

## License

AGPLv3, however earlier commits (before f1730aed53a939a520a6acfecde6f641e06a215d) used a different license, because of mistertfy64's lack of knowledge and indecisiveness. See the [LICENSE](https://github.com/mathematicalbasedefenders/play.mathematicalbasedefenders.com/blob/master/LICENSE) file for details.
