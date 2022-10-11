#!/bin/bash
set -eu
# This is a backwards compatibility script. All logic has moved to '@aws-cdk-testing/cli-integ'
# and should be called from there directly.

# Contract: '@aws-cdk-testing/cli-integ' package is installed in ${INTEG_TOOLS}
previous=$(${INTEG_TOOLS}/bin/query-github last-release --prior-to $VERSION)

# Obtain the right version of @aws-cdk-testing/cli-integ (must not be 'npm install'ed, so use 'npm pack')
testball=$(npm pack @aws-cdk-testing/cli-integ@$previous) || {
    echo "During migration, @aws-cdk-testing/cli-integ@$previous does not exist yet." >&2
    exit 0
}

mkdir old_tests
tar xzvf "${testball}" -C old_tests --strip 1
(cd old_tests && npm install --production)

# Apply new patches to old tests
${INTEG_TOOLS}/bin/apply-patches $previous old_tests

# Old tests, new CLI, old framework
exec old_tests/bin/run-suite --use-version=$VERSION --framework-version=$previous cli-integ-tests
