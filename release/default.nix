{ age
, git
, sentry-cli
, python3Packages
}:

python3Packages.buildPythonApplication {
  name = "release";
  src = ./.;

  pyproject = true;

  runtimeInputs = [ age git sentry-cli ];
  nativeBuildInputs = with python3Packages; [ setuptools wheel ];
  propagatedBuildInputs = [ python3Packages.click ];
}
