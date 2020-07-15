import path from 'path';
import { promisify } from 'util';
import fs from 'fs';

const readFile = promisify(fs.readFile);
const toLowerCase = (str) => str.toLowerCase();
const dashToPascalCase = (str) => toLowerCase(str).split('-').map(segment => segment.charAt(0).toUpperCase() + segment.slice(1)).join('');
function sortBy(array, prop) {
    return array.slice().sort((a, b) => {
        const nameA = prop(a);
        const nameB = prop(b);
        if (nameA < nameB)
            return -1;
        if (nameA > nameB)
            return 1;
        return 0;
    });
}
function normalizePath(str) {
    // Convert Windows backslash paths to slash paths: foo\\bar ➔ foo/bar
    // https://github.com/sindresorhus/slash MIT
    // By Sindre Sorhus
    if (typeof str !== 'string') {
        throw new Error(`invalid path to normalize`);
    }
    str = str.trim();
    if (EXTENDED_PATH_REGEX.test(str) || NON_ASCII_REGEX.test(str)) {
        return str;
    }
    str = str.replace(SLASH_REGEX, '/');
    // always remove the trailing /
    // this makes our file cache look ups consistent
    if (str.charAt(str.length - 1) === '/') {
        const colonIndex = str.indexOf(':');
        if (colonIndex > -1) {
            if (colonIndex < str.length - 2) {
                str = str.substring(0, str.length - 1);
            }
        }
        else if (str.length > 1) {
            str = str.substring(0, str.length - 1);
        }
    }
    return str;
}
function relativeImport(pathFrom, pathTo, ext) {
    let relativePath = path.relative(path.dirname(pathFrom), path.dirname(pathTo));
    if (relativePath === '') {
        relativePath = '.';
    }
    else if (relativePath[0] !== '.') {
        relativePath = './' + relativePath;
    }
    return normalizePath(`${relativePath}/${path.basename(pathTo, ext)}`);
}
async function readPackageJson(rootDir) {
    const pkgJsonPath = path.join(rootDir, 'package.json');
    let pkgJson;
    try {
        pkgJson = await readFile(pkgJsonPath, 'utf8');
    }
    catch (e) {
        throw new Error(`Missing "package.json" file for distribution: ${pkgJsonPath}`);
    }
    let pkgData;
    try {
        pkgData = JSON.parse(pkgJson);
    }
    catch (e) {
        throw new Error(`Error parsing package.json: ${pkgJsonPath}, ${e}`);
    }
    return pkgData;
}
const EXTENDED_PATH_REGEX = /^\\\\\?\\/;
const NON_ASCII_REGEX = /[^\x00-\x80]+/;
const SLASH_REGEX = /\\/g;

async function reactProxyOutput(compilerCtx, outputTarget, components, config) {
    const filteredComponents = getFilteredComponents(outputTarget.excludeComponents, components);
    const rootDir = config.rootDir;
    const pkgData = await readPackageJson(rootDir);
    const finalText = generateProxies(filteredComponents, pkgData, outputTarget, rootDir);
    await compilerCtx.fs.writeFile(outputTarget.proxiesFile, finalText);
    await copyResources(config, outputTarget);
}
function getFilteredComponents(excludeComponents = [], cmps) {
    return sortBy(cmps, (cmp) => cmp.tagName).filter((c) => !excludeComponents.includes(c.tagName) && !c.internal);
}
function generateProxies(components, pkgData, outputTarget, rootDir) {
    const distTypesDir = path.dirname(pkgData.types);
    const dtsFilePath = path.join(rootDir, distTypesDir, GENERATED_DTS);
    const componentsTypeFile = relativeImport(outputTarget.proxiesFile, dtsFilePath, '.d.ts');
    const imports = `/* eslint-disable */
/* tslint:disable */
/* auto-generated react proxies */
import { createReactComponent } from './react-component-lib';\n`;
    const typeImports = !outputTarget.componentCorePackage
        ? `import { ${IMPORT_TYPES} } from '${normalizePath(componentsTypeFile)}';\n`
        : `import { ${IMPORT_TYPES} } from '${normalizePath(outputTarget.componentCorePackage)}';\n`;
    const pathToCorePackageLoader = normalizePath(path.join(outputTarget.componentCorePackage || '', outputTarget.loaderDir || DEFAULT_LOADER_DIR));
    let sourceImports = '';
    let registerCustomElements = '';
    if (outputTarget.includePolyfills && outputTarget.includeDefineCustomElements) {
        sourceImports = `import { ${APPLY_POLYFILLS}, ${REGISTER_CUSTOM_ELEMENTS} } from '${pathToCorePackageLoader}';\n`;
        registerCustomElements = `${APPLY_POLYFILLS}().then(() => ${REGISTER_CUSTOM_ELEMENTS}());`;
    }
    else if (!outputTarget.includePolyfills && outputTarget.includeDefineCustomElements) {
        sourceImports = `import { ${REGISTER_CUSTOM_ELEMENTS} } from '${pathToCorePackageLoader}';\n`;
        registerCustomElements = `${REGISTER_CUSTOM_ELEMENTS}();`;
    }
    const final = [
        imports,
        typeImports,
        sourceImports,
        registerCustomElements,
        components.map(createComponentDefinition).join('\n'),
    ];
    return final.join('\n') + '\n';
}
function createComponentDefinition(cmpMeta) {
    const tagNameAsPascal = dashToPascalCase(cmpMeta.tagName);
    return [
        `export const ${tagNameAsPascal} = /*@__PURE__*/createReactComponent<${IMPORT_TYPES}.${tagNameAsPascal}, HTML${tagNameAsPascal}Element>('${cmpMeta.tagName}');`,
    ];
}
async function copyResources(config, outputTarget) {
    if (!config.sys || !config.sys.copy || !config.sys.glob) {
        throw new Error('stencil is not properly initialized at this step. Notify the developer');
    }
    const srcDirectory = path.join(__dirname, '..', 'react-component-lib');
    const destDirectory = path.join(path.dirname(outputTarget.proxiesFile), 'react-component-lib');
    return config.sys.copy([
        {
            src: srcDirectory,
            dest: destDirectory,
            keepDirStructure: false,
            warn: false,
        },
    ], srcDirectory);
}
const GENERATED_DTS = 'components.d.ts';
const IMPORT_TYPES = 'JSX';
const REGISTER_CUSTOM_ELEMENTS = 'defineCustomElements';
const APPLY_POLYFILLS = 'applyPolyfills';
const DEFAULT_LOADER_DIR = '/loader';

const reactOutputTarget = (outputTarget) => ({
    type: 'custom',
    name: 'react-library',
    validate(config) {
        return normalizeOutputTarget(config, outputTarget);
    },
    async generator(config, compilerCtx, buildCtx) {
        const timespan = buildCtx.createTimeSpan(`generate react started`, true);
        await reactProxyOutput(compilerCtx, outputTarget, buildCtx.components, config);
        timespan.finish(`generate react finished`);
    },
});
function normalizeOutputTarget(config, outputTarget) {
    var _a, _b;
    const results = Object.assign(Object.assign({}, outputTarget), { excludeComponents: outputTarget.excludeComponents || [], includePolyfills: (_a = outputTarget.includePolyfills) !== null && _a !== void 0 ? _a : true, includeDefineCustomElements: (_b = outputTarget.includeDefineCustomElements) !== null && _b !== void 0 ? _b : true });
    if (config.rootDir == null) {
        throw new Error('rootDir is not set and it should be set by stencil itself');
    }
    if (outputTarget.proxiesFile == null) {
        throw new Error('proxiesFile is required');
    }
    if (outputTarget.directivesProxyFile && !path.isAbsolute(outputTarget.directivesProxyFile)) {
        results.proxiesFile = normalizePath(path.join(config.rootDir, outputTarget.proxiesFile));
    }
    return results;
}

export { reactOutputTarget };
