import { OutputTargetReact, PackageJSON } from './types';
import { CompilerCtx, ComponentCompilerMeta, Config } from '@stencil/core/internal';
export declare function reactProxyOutput(compilerCtx: CompilerCtx, outputTarget: OutputTargetReact, components: ComponentCompilerMeta[], config: Config): Promise<void>;
export declare function generateProxies(components: ComponentCompilerMeta[], pkgData: PackageJSON, outputTarget: OutputTargetReact, rootDir: string): string;
export declare const GENERATED_DTS = "components.d.ts";
