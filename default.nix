{ callPackage
, writeShellScript
, yarn2nix-moretea
, mkShell
, devPackages
, sentry-cli
, nixVersions
, pre-commit
, age
}:

let
  nodeModules = yarn2nix-moretea.mkYarnModules {
    pname = "cf-worker-deps";
    version = "0.0.0";
    packageJSON = ./package.json;
    yarnLock = ./yarn.lock;
  };

  releaseTool = callPackage ./release { inherit nodeModules; };
  workerBundle = callPackage ./build.nix { inherit releaseTool nodeModules; };
  bundle = "${workerBundle}/index.js";
in
{
  shell = mkShell {
    packages = devPackages.node.allNode21 ++ [
      age
      devPackages.node.yarn
      devPackages.python.python311
      sentry-cli
      pre-commit
      nixVersions.nix_2_17
    ];
  };

  inherit workerBundle;
  releaseTool = writeShellScript "release" ''
    ${releaseTool}/bin/release deploy $@ ${bundle} ${bundle}.map;
  '';
}
