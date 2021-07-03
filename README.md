# Dash My Plugins

A very simple dashboard which displays information about defined WordPress plugins. It has been built on NextJS and doesn't require any database.

## Installation

It requires [Node.js](https://nodejs.org/) v12+ to run.

Install the dependencies, create an .env.local file containing a PLUGIN variable with the slugs of your plugins, and start the server.

```sh
yarn
echo "PLUGINS = "media-cleaner, media-file-renamer"" > .env.local
yarn dev
```