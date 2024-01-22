{ callPackage
, mkShell
, devPackages
, sentry-cli
, nixVersions
, pre-commit
, age
}:

let
  releaseTool = callPackage ./release { };
  workerBundle = callPackage ./build.nix { inherit releaseTool; };

  bundle = "${workerBundle}/index.js";
  deployCmd = "${releaseTool}/bin/release deploy $@ ${bundle} ${bundle}.map";
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
  inherit releaseTool;
  inherit deployCmd;
}
