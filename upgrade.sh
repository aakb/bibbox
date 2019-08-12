#!/usr/bin/env bash

# Install main modules
rm -rf node_modules
npm install --${1:-production}

# Install plugin dependencies.
for folder in plugins/*; do
  if [ -d $folder ]; then
    cd $folder
    echo ${folder}
    rm -rf node_modules
    npm install --${1:-production}
    npm audit
    cd ../..
  fi
done
