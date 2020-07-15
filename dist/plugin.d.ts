import { Config, OutputTargetCustom } from '@stencil/core/internal';
import { OutputTargetReact } from './types';
export declare const reactOutputTarget: (outputTarget: OutputTargetReact) => OutputTargetCustom;
export declare function normalizeOutputTarget(config: Config, outputTarget: any): OutputTargetReact;
