{ callPackage
, mkShell
, devPackages
, yarn
, sentry-cli
, nixVersions
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
      yarn
      sentry-cli
      pre-commit
      nixVersions.nix_2_17
    ];
  };

  inherit (worker) workerBundle releaseTool;
}
