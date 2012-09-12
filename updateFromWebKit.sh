#!/bin/sh
# update atopwi from WebKit
set -xev
git checkout built-devtools

BUILD=$( cat .git/tx-other-repos/inspector | sed -e 's|/third_party/WebKit/Source/WebCore/inspector/front-end/|/out/Release/resources/inspector|' )
echo $BUILD

cp $BUILD/devtools_extension_api.js extension/atopwi/inspector/front-end
cp $BUILD/InspectorBackendCommands.js extension/atopwi/inspector/front-end
cp $BUILD/devtools.html extension/atopwi/inspector/front-end

patch --merge -p1 < extension/atopwi/devtoolsAdapter/devtools.html.patch
