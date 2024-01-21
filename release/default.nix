{ age
, git
, sentry-cli
, nodeModules
, python3Packages
}:

python3Packages.buildPythonApplication {
  name = "release";
  runtimeInputs = [ age git sentry-cli ];

  pyproject = true;

  nativeBuildInputs = [
    python3Packages.setuptools
    python3Packages.wheel
  ];

  propagatedBuildInputs = [
    python3Packages.click
  ];

  src = ./.;
}
