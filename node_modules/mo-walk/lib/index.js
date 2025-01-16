'use strict';

const Assert = require('assert');
const { promises: Fs } = require('fs');
const Path = require('path');
const Url = require('url');
const PkgUp = require('pkg-up');

const internals = {};

exports.walk = async (mo, path, options = {}) => {

    path = Path.resolve(Path.dirname(mo.filename), path);

    const {
        extensions = exports.defaultExtensions,
        include = () => true,
        exclude = () => false,
        recursive = true,
        stopAtIndexes = true,
        defaultToESM = await exports.getDefaultToESM(path),
        visit
    } = options;

    Assert.ok(typeof visit === 'function', 'Please specify options.visit as a function.');

    const entryFilename = (dirname, entry) => Path.join(dirname, entry.name);

    const entryMatches = (dirname, entry) => {

        const filename = entryFilename(dirname, entry);
        const extension = Path.extname(entry.name).slice(1);

        return extensions.includes(extension) &&
            include(filename, entry.name) &&
            !exclude(filename, entry.name);
    };

    const walkEntry = async (dirname, entry) => {

        const filename = entryFilename(dirname, entry);
        const extname = Path.extname(entry.name);
        if (extname === '.mjs' || (defaultToESM && extname === '.js')) {
            const url = Url.pathToFileURL(filename).href; // Relates to windows, see nodejs/node#31710
            const value = await import(url);
            await visit(value, filename, entry.name, 'esm');
        }
        else {
            const value = mo.require(filename);
            await visit(value, filename, entry.name, 'cjs');
        }
    };

    const walkDirectory = async (dirname) => {

        const directories = [];
        const files = [];
        const indexes = [];
        const entries = await Fs.readdir(dirname, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                directories.push(entry);
            }
            else if (entryMatches(dirname, entry)) {
                files.push(entry);
                if (Path.basename(entry.name, Path.extname(entry.name)) === 'index') {
                    indexes.push(entry);
                }
            }
        }

        if (stopAtIndexes && indexes.length) {
            Assert.ok(indexes.length === 1, `Multiple index entries found in ${dirname}: ${indexes.map((e) => e.name).join(', ')}.`);
            await walkEntry(dirname, indexes[0]);
        }
        else {
            await Promise.all(files.map(
                (entry) => walkEntry(dirname, entry)
            ));
            if (recursive) {
                await Promise.all(directories.map(
                    (entry) => walkDirectory(entryFilename(dirname, entry))
                ));
            }
        }
    };

    await walkDirectory(path);
};

exports.defaultExtensions = ['js', 'mjs', 'json', 'ts'];

exports.tryToResolve = async (path, opts = {}) => {

    const {
        defaultToESM = await exports.getDefaultToESM(Path.dirname(path))
    } = opts;

    const extname = Path.extname(path);

    if (extname === '.mjs' || (defaultToESM && extname === '.js')) {
        return await internals.tryToResolveESM(path);
    }

    return internals.tryToResolveCJS(path) ||
        await internals.tryToResolveESM(`${path}.mjs`) ||
        (defaultToESM && await internals.tryToResolveESM(`${path}.js`)) ||
        await internals.tryToResolveESM(Path.join(path, 'index.mjs')) ||
        (defaultToESM && await internals.tryToResolveESM(Path.join(path, 'index.js'))) ||
        undefined;
};

exports.getDefaultToESM = async (dirname) => {

    try {
        const packagePath = await PkgUp({ cwd: dirname });
        return require(packagePath).type === 'module';
    }
    catch {
        return false;
    }
};

exports.getDefaultExport = (exports_, path, type) => {

    const exportsObjectWithDefault = exports_ && typeof exports_ === 'object' && 'default' in exports_;

    if ((type === 'esm' || Path.extname(path) === '.ts') && exportsObjectWithDefault) {
        return exports_.default;
    }

    if (type === 'cjs' && exportsObjectWithDefault && exports_.__esModule) {
        return exports_.default;
    }

    return exports_;
};

internals.tryToResolveCJS = (path) => {

    try {
        const filepath = require.resolve(path);
        return [require(path), filepath, 'cjs'];
    }
    catch (err) {
        Assert.ok((err.code === 'MODULE_NOT_FOUND' && err.message.includes(`'${path}'`)) || err.code === 'ERR_REQUIRE_ESM', err);
    }
};

internals.tryToResolveESM = async (filepath) => {

    // Handles edge-case around windows import() requiring a file URL to disambiguate the C:/, see nodejs/node#31710
    const url = Url.pathToFileURL(filepath).href;

    try {
        return [await import(url), filepath, 'esm'];
    }
    catch (err) {
        Assert.ok(err.code === 'ERR_MODULE_NOT_FOUND' && err.message.includes(`'${filepath}'`), err);
    }
};
