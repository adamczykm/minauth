#!/bin/bash

# Check if direnv is installed
if ! command -v direnv &> /dev/null; then
  echo "Error: 'direnv' is not installed. Please install it and try again."
  exit 1
fi

# Check if the path to the .envrc file is provided
if [ -z "$1" ]; then
  echo "Please provide the path to the .envrc file as an argument."
  exit 1
fi

# Resolve the absolute path of the given .envrc file
DIRPATH=$(realpath "$1")
ENVRCPATH=$DIRPATH/.envrc

# Construct the export command using the current working directory
NODE_MODULES_PATH=$DIRPATH/node_modules
EXPORT_COMMAND="export NODE_MODULES=${NODE_MODULES_PATH}"

# Check if the .envrc file exists, if not, create it
if [ ! -f "$ENVRCPATH" ]; then
  touch "$ENVRCPATH"
fi

# Check if the export command is already present in the .envrc file
if grep -Fxq "$EXPORT_COMMAND" "$ENVRCPATH"; then
  echo "NODE_MODULES is already set in ${ENVRCPATH}"
else
  # Append the export command to the file
  echo "$EXPORT_COMMAND" >> "$ENVRCPATH"
  echo "Successfully added NODE_MODULES to ${ENVRCPATH}"
fi

