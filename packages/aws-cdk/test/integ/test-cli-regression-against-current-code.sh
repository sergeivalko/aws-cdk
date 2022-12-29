#!/bin/bash
set -eu
set -x
# This is a backwards compatibilty script. All logic has moved to '@aws-cdk-testing/cli-integ'
# and should be called from there directly.

# Contract: '@aws-cdk-testing/cli-integ' package is installed in ${INTEG_TOOLS}
previous=$(${INTEG_TOOLS}/bin/query-github last-release --token $GITHUB_TOKEN --prior-to $VERSION)
echo "Previous version is: $previous"

echo "NPM version"
npm --version

export OLD_TESTS=old_tests
$INTEG_TOOLS/bin/download-old-tests "$previous" "$OLD_TESTS"

# Old tests, new CLI, new framework
exec $OLD_TESTS/bin/run-suite --use-version=$VERSION cli-integ-tests
