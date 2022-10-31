#!/bin/bash
set -eu
# This is a backwards compatibility script. All logic has moved to '@aws-cdk-testing/cli-integ'
# and should be called from there directly.

# Contract: '@aws-cdk-testing/cli-integ' package is installed in ${INTEG_TOOLS}
previous=$(${INTEG_TOOLS}/bin/query-github last-release --token $GITHUB_TOKEN --prior-to $VERSION)
echo "Previous version is: $previous"

# Obtain the right version of @aws-cdk-testing/cli-integ (must not be 'npm install'ed, so use 'npm pack')
if ! npm view @aws-cdk-testing/cli-integ@$previous --loglevel=silent; then
    echo "During migration, @aws-cdk-testing/cli-integ@$previous does not exist yet." >&2
    exit 0
fi

echo "Installing test package: @aws-cdk-testing/cli-integ@$previous"

# The package MUST be 'npm install'ed from the package repository (`npm install --production`
# will not work because that will resolve devDependencies even though it will not install them),
# but it may not live in a 'node_modules' directory because Jest 27 does not support that. Do contortions.
export OLD_TESTS=old_tests
rm -rf $OLD_TESTS && mkdir $OLD_TESTS
npm install --prefix $OLD_TESTS --no-save @aws-cdk-testing/cli-integ@$previous
mv $($OLD_TESTS/node_modules/.bin/test-root)/* $OLD_TESTS

# Apply new patches to old tests
${INTEG_TOOLS}/bin/apply-patches $previous $OLD_TESTS

# Old tests, new CLI, old framework
exec $OLD_TESTS/bin/run-suite --use-version=$VERSION --framework-version=$previous cli-integ-tests
