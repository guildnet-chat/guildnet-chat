# Contributing

The web chat follows GuildNet's way of working:
[CONTRIBUTING.md](https://github.com/guildnet-chat/guildnet/blob/main/CONTRIBUTING.md),
and its [code of conduct](https://github.com/guildnet-chat/guildnet/blob/main/CODE_OF_CONDUCT.md).
Like GuildNet, **it isn't taking code changes yet**: bug reports and ideas
are very welcome as issues. A bug that's gamja's own can go to gamja
upstream as a patch, as below.

Here, you need Node (the version CI uses, in
[.github/workflows/ci.yml](.github/workflows/ci.yml)):

```bash
npm install
npm run lint
npm test
npm run build
```

`npm start` runs a development server; GuildNet's console serves the built
chat (`dist/`) when you build its image beside this repo.

Keep changes close to gamja's code and style, so the fork can keep taking
gamja's own changes. A fix that isn't about GuildNet is better sent to
[gamja](https://codeberg.org/emersion/gamja) upstream.

A dependency that ships in the chat must be under a permissive licence:
`node .github/licences.mjs` checks, and so does CI.
