{ age
, git
, sentry-cli
, lib
, python3Packages
, nodeModules
}:

let
  path = lib.makeBinPath [ age git sentry-cli ];
in
python3Packages.buildPythonApplication {
  name = "release";
  src = ./.;

  pyproject = true;

  nativeBuildInputs = with python3Packages; [ setuptools wheel ];
  propagatedBuildInputs = [ python3Packages.click ];

  postFixup = ''
    wrapProgram $out/bin/release \
    --prefix PATH : ${path} \
    --set WRANGLER_BIN ${nodeModules}/node_modules/.bin/wrangler2 \
    --set NODE_MODULES_DIR ${nodeModules}/node_modules
  '';
}
