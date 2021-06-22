/* eslint-disable no-cond-assign */
import { CodeTranspileResult } from "./CodeTranspileResult";
import { REACT_CODE } from "./converters/ReactConverter";
import {
    CodeConverterHowToUse, CodeConverterPathRule, CodeConverterPlugin,
    CodeConverterStatus, CodeConvertOptions,
} from "./types";
import { convertArrayTemplate, filterFramework } from "./utils";


export default class CodeConverter implements CodeConverterStatus {
    public indent = 4;
    public pathRules: CodeConverterPathRule[] = [];
    public code = "";
    public howToUses: CodeConverterHowToUse[] = [];

    constructor(code: string, options: CodeConvertOptions = {}) {
        for (const name in options) {
            (this as any)[name] = (options as any)[name];
        }
        this.setCode(code);
    }
    public setCode(code: string) {
        this.code = code;
    }
    public addPathRule(pathRule: CodeConverterPathRule) {
        this.pathRules.push({
            specifiers: {},
            ...pathRule,
        });
    }
    public addHowToUse(howToUse: CodeConverterHowToUse) {
        this.howToUses.push(howToUse);
    }
    public convertTemplate(plugin: CodeConverterPlugin = REACT_CODE): any {
        const targetFramework = plugin.framework;
        const transpileResult = new CodeTranspileResult(plugin, {
            code: this.code,
            indent: this.indent,
            howToUses: filterFramework(this.howToUses, targetFramework),
            pathRules: filterFramework(this.pathRules, targetFramework),
        });
        try {
            return plugin(transpileResult);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
        }
        return "";
    }
    public convert(plugin: CodeConverterPlugin = REACT_CODE, props: Record<string, any> = {}): any {
        const template = this.convertTemplate(plugin);

        return convertArrayTemplate(template, props);
    }
}
