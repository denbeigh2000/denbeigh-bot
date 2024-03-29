{ stdenvNoCC
, releaseTool
, nodeModules
}:

let
  # nodeModules = js2nix.makeNodeModules ./package.json {
  #   tree = js2nix.load ./yarn.lock {};
  # };
in

stdenvNoCC.mkDerivation {
  pname = "denbeigh-bot-cfworker-bundle";
  version = "0.0.0";

  src = ./.;

  # IDEA: In this step, we use wrangler's bundling process via publish --dry-run
  # to run the provided minification + bundling, then write that to the Nix
  # store. We can then publish in the next step by running
  # publish --no-bundle. This may also require a custom build step(?)

  # TODO: change WRANGLER_BIN? we provide node_modules here anyway.
  buildPhase = ''
    ${releaseTool}/bin/release build "$out" "${nodeModules}/node_modules"
  '';
}
