{ stdenvNoCC
, writeShellScript
, age
, git
, sentry-cli
, nodeModules
}:

let
  workerBundle = stdenvNoCC.mkDerivation {
    pname = "denbeigh-bot-cfworker-bundle";
    version = "0.0.0";

    src = ./.;

    # IDEA: In this step, we use wrangler's bundling process via publish --dry-run
    # to run the provided minification + bundling, then write that to the Nix
    # store. We can then publish in the next step by running
    # publish --no-bundle. This may also require a custom build step(?)
    buildPhase = ''
      WRANGLER_BIN="${nodeModules}/node_modules/.bin/wrangler2"
      NODE_MODULES_PATH="${nodeModules}"

      ${builtins.readFile ./build.sh}
    '';
  };
in

{
  inherit workerBundle;
  releaseTool = writeShellScript "release.sh" ''
    set -euo pipefail

    WRANGLER_BIN="${nodeModules}/node_modules/.bin/wrangler2"
    AGE_BIN="${age}/bin/age"
    GIT_BIN="${git}/bin/git"
    SENTRY_BIN="${sentry-cli}/bin/sentry-cli"
    BUNDLED_WORKER_PATH="${workerBundle}"

    ${builtins.readFile ./release.sh}
  '';
}
