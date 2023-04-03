{ callPackage
, mkShell
, devPackages
, neovim
, yarn
, sentry-cli
, pre-commit
, age
, yarn2nix-moretea
}:

let
  # nodeModules = js2nix.makeNodeModules ./package.json {
  #   tree = js2nix.load ./yarn.lock {};
  # };
  nodeModules = yarn2nix-moretea.mkYarnModules {
    pname = "cf-worker-deps";
    version = "0.0.0";
    packageJSON = ./package.json;
    yarnLock = ./yarn.lock;
  };

  worker = callPackage ./build.nix { inherit nodeModules; };
in
{
  shell = mkShell {
    packages = devPackages.node.allNode18 ++ [
      age
      neovim
      yarn
      sentry-cli
      pre-commit
    ];
  };

  inherit (worker) workerBundle releaseTool;
}
