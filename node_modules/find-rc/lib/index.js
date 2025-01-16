'use strict';

const Fs = require('fs');
const Path = require('path');


const internals = {};


module.exports = function (appname, startDir) {
  const filenames = [
    `.${appname}rc.js`,
    `.${appname}rc.cjs`,
    `.${appname}rc.mjs`
  ];
  const dirPaths = internals.dirPaths(startDir || process.cwd(), filenames);
  const homePaths = internals.homePaths(filenames);

  // Didn't find in the parent folders, try at home next
  return internals.checkPaths(dirPaths) || internals.checkPaths(homePaths);
};


internals.checkPaths = function (paths, index) {
  index = index || 0;
  if (internals.isFile(paths[index])) {
    return paths[index];
  }

  if (++index === paths.length) {
    return;
  }

  return internals.checkPaths(paths, index);
};


internals.isFile = function (filePath) {
  try {
    const stat = Fs.statSync(filePath);
    return stat.isFile();
  } catch (err) {
    return false;
  }
};


internals.dirPaths = function (directory, filenames) {
  const filePaths = [];
  const pathRoot = Path.parse(directory).root;

  do {
    for (const filename of filenames) {
      filePaths.push(Path.join(directory, filename));
    }
    directory = Path.dirname(directory);
  } while (directory !== pathRoot);

  return filePaths;
};


internals.homePaths = function (filenames) {
  const filePaths = [];
  const home = process.env.USERPROFILE || process.env.HOME || '';
  for (const filename of filenames) {
    filePaths.push(Path.join(home, filename));
    filePaths.push(Path.join(home, '.config', filename));
  }
  return filePaths;
};
