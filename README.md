# denbeigh-bot

## What

This is the bot I use to manage my personal Discord server.

It provides:
 - a tiered user-privilege system
 - user-configurable groups (roless)
 - user approval with a waiting room
 - guest inviting

I run it on CloudFlare Workers free tier, and build/deploy it using Nix and Wrangler.

The bundle is stored in the Nix store to take advantage of reusability, remote
caching, etc.

## Why

I hadn't seen any good examples of using Wrangler via Nix, and I thought this
may be useful to others.

## How

 - Build: `nix build .#workerBundle`
 - Deploy (requires credentials): `nix run .#releaseTool [staging|production]`

## Note

In case you are setting this up for your own server:

I've made several configurations on my own server that this assumes (e.g.,
permissions, role names, etc.). As this is a practical tool for managing my
own server, I haven't documented these and don't really plan to.
