import { normalizePath } from './utils';
import { reactProxyOutput } from './output-react';
import path from 'path';
export const reactOutputTarget = (outputTarget) => ({
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
export function normalizeOutputTarget(config, outputTarget) {
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
