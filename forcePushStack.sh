#!/bin/sh
set -e -x
git checkout syncToWebKit
git push -f origin  syncToWebKit 
git checkout iframeable
git push -f origin  iframeable  
git checkout remoteDebug
git push -f origin  remoteDebug  
git checkout DebuggerProtocol
git push -f origin  DebuggerProtocol  
git checkout extendable
git push -f origin  extendable  
git checkout purple
git push -f origin  purple  
git push -f origin  master  
