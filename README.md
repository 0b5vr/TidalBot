# TidalBot

Play with TidalCycles in Discord voice chat!!

## Installation

### Prerequisite

[Docker](https://hub.docker.com/search/?type=edition&offering=community)

### Setup your discord app token

- Go to https://discordapp.com/developers/applications/
- Retrieve your bot token
- Paste the token in `.env` :
  ```
  TIDALBOT_TOKEN=<YOUR BOT TOKEN FROM https://discordapp.com/developers/applications/>
  ```

### Build and run

- Enter these commands:
  ```sh
  docker build -t tidal-bot .
  docker run -it --env-file .env --rm tidal-bot
  ```

## How to use

- Invite the bot:
  `https://discord.com/oauth2/authorize?client_id=<YOUR ID HERE>&scope=bot&permissions=36703232`

- Join in any VC
- Mention TidalBot along with your code:
  > @TidalBot
  > ```
  > d1
  >   $ sound "bd bd"
  > ```
- Now TidalBot joins in your VC automatically and plays cool music for you!

### Special commands

- If you want to let TidalBot leave your VC, type this:
  > @TidalBot bye
- If you want to see SuperCollider's log, type this:
  > @TidalBot sc-log

## nice-to-pin.md

You might want to pin the content of [nice-to-pin.md](./nice-to-pin.md) on your Discord channel.

## License

MIT
