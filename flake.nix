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
  };

  outputs = { self, nixpkgs, flake-utils, denbeigh }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ denbeigh.overlays.default ];
        };

        pkg = pkgs.callPackage ./default.nix { };

        inherit (pkg) shell releaseTool;
      in
      {
        apps.releaseTool = {
          type = "app";
          program = "${releaseTool}/bin/release";
        };

        devShells = {
          default = shell;
          dev = shell;
        };

        packages = {
          inherit (pkg) workerBundle releaseTool;
        };
      }
    );
}
