{
  description = "Denbeigh's discord bot on CF workers";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";

    flake-utils.url = "github:numtide/flake-utils";

    # NOTE: We can't use this due to esbuild needing to chmod in post-install
    # TODO: Write an isolated-ish bug report
    # js2nix = {
    #   url = "github:canva-public/js2nix";
    #   flake = false;
    # };

    denbeigh = {
      url = "github:denbeigh2000/nix-dev";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    denbeigh-ci = {
      url = "github:denbeigh2000/ci";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        flake-utils.follows = "flake-utils";
      };
    };
  };

  outputs = { self, nixpkgs, flake-utils, denbeigh, denbeigh-ci }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ denbeigh.overlays.default ];
        };

        pkg = pkgs.callPackage ./default.nix { };

        inherit (pkg) shell releaseTool workerBundle;
      in
      {
        apps.releaseTool = {
          type = "app";
          program = "${releaseTool}";
        };

        ci = denbeigh-ci.lib.mkCIConfig { inherit self pkgs; };

        devShells = {
          default = shell;
          dev = shell;
        };

        packages = {
          inherit (pkg) workerBundle releaseTool;
          ci-tool = denbeigh-ci.packages.${system}.tool;
        };
      }
    );
}
