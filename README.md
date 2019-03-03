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

- Join in any VC
- Mention TidalBot along with your code (code must be in code blocks):
  > @TidalBot
  > ```
  > d1
  >   $ sound "bd bd"
  > ```
- Now TidalBot joins in your vc automatically and plays cool music for you!

### Other

- If you want to see SuperCollider's log, type this:
  > @TidalBot sc-log

## License

MIT