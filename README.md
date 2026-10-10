# guildnet-chat

GuildNet's web chat: a fork of [gamja], a simple IRC web client, made to
work inside [GuildNet](https://github.com/guildnet-chat/guildnet)'s
console. The console serves it, signed in as you, docked beside its pages.
What follows the screenshot is gamja's own guide, which still holds for
running it on its own.

<img src="https://fs.emersion.fr/protected/img/gamja/main.png" alt="Screenshot" width="800">

## Usage

Requires an IRC WebSocket server.

First install dependencies:

    npm install --omit=dev

Then [configure an HTTP server] to serve the gamja files.

### Development server

If you don't have an IRC WebSocket server at hand, gamja's development server
can be used. For instance, to run gamja on Libera Chat:

    npm install --include=dev
    npm start -- irc.libera.chat

See `npm start -- -h` for a list of options.

### Production build

Optionally, [Parcel] can be used to build a minified version of gamja.

    npm install --include=dev
    npm run build

## Configuration

gamja can be configured via a [configuration file] and via [URL parameters].

## Contributing

Something to do with GuildNet goes here: see [CONTRIBUTING.md](CONTRIBUTING.md),
and [SECURITY.md](SECURITY.md) for security problems. A bug that's
gamja's own, and isn't about GuildNet, is better sent upstream: patches on
[Codeberg], bugs on gamja's [issue tracker], talk in
[#soju on Libera Chat].

## License

AGPLv3 only, see LICENSE.

Copyright (C) 2020 The gamja Contributors, and The GuildNet Authors for
GuildNet's changes

[gamja]: https://codeberg.org/emersion/gamja
[Codeberg]: https://codeberg.org/emersion/gamja
[issue tracker]: https://codeberg.org/emersion/gamja/issues
[Parcel]: https://parceljs.org
[configure an HTTP server]: doc/setup.md
[configuration file]: doc/config-file.md
[URL parameters]: doc/url-params.md
[#soju on Libera Chat]: ircs://irc.libera.chat/#soju
