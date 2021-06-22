import { CodeTranspileResult } from "./CodeTranspileResult";

export type CodeConverterPlugin = ((converter: CodeTranspileResult) => any) & {
    framework: string;
    options: Partial<CodeConverterPluginOptions>;
};
export interface CodeConverterPluginOptions {
    setter: (variable: CodeConverterVariable, value: string) => string;
    getterRef: (ref: CodeConverterRef) => string;
    findRef?: (ref: CodeConverterRef) => RegExp;
    findSetterArea?: (text: string, setter: string) => CodeConverterMatchResult;
    refName: (ref: CodeConverterRef) => string;
}
export interface CodeConvertOptions {
    indent?: number;
}
export interface CodeConverterImport {
    text?: string;
    framework?: string;
    specifiers: Record<string, string>;
    module: string;
}

export interface CodeConverterPathRule {
    framework: string;
    rule: RegExp | string;
    module: string;
    specifiers?: Record<string, string>;
}
export interface CodeConverterStatus {
    code: string;
    howToUses: CodeConverterHowToUse[];
    pathRules: CodeConverterPathRule[];
    indent: number;
}

export interface CodeConverterHowToUse {
    framework?: string | string[];
    component: string;
    imports: CodeConverterImport[];
    html?(nodeResult: CodeConverterNodeResult, transpileResult: CodeTranspileResult): CodeConverterNodeResult | null;
    instance?(nodeResult: CodeConverterNodeResult, transpileResult: CodeTranspileResult): string,
}


export interface CodeConverterMatchArea {
    result: RegExpExecArray | null;
    text: string;
    originalText: string;
}

export interface CodeConverterRef {
    name: string;
    originalName: string;
}
export interface CodeConverterVariable extends CodeConverterRef {
    setter: string;
    value: string;
    defaultValue: string;
    isFunction: boolean;
}

export interface CodeConverterMatchResult {
    opener: CodeConverterMatchArea;
    closer: CodeConverterMatchArea;
    text: string;
    originalText: string;
}

export interface CodeConverterNodeAttribute {
    name: string;
    value: string;
    defaultValue: string;
    originalValue: string;
    dynamic: boolean;
}
export interface CodeConverterMethod extends CodeConverterNodeEvent {
    isArrow?: boolean;
}
export interface CodeConverterNodeEvent {
    name: string,
    params: string[];
    paramsArea: CodeConverterMatchResult | null;
    text: string;
    isFunction: boolean;
}

export interface CodeConverterNode {
    target: string;
    ref: CodeConverterRef;
    className: CodeConverterNodeAttribute;
    attributes: CodeConverterNodeAttribute[];
    events: CodeConverterNodeEvent[];
    children: Array<string | CodeConverterNode>;
    inline: boolean;
    isComponent: boolean;
    parentNode: CodeConverterNode | null;
}

export interface CodeConverterNodeResult {
    rootNode: CodeConverterNode;
    inlineNodes: CodeConverterInlineNode[];
}

export interface CodeConverterInlineNode<T extends CodeConverterNode | string = CodeConverterNode | string> {
    type: "node" | "text";
    value: T;
    isOpen: boolean;
    isClose: boolean;
}

export interface IndentOptions {
    indent?: number;
    startIndent?: number;
    endIndent?: number;
    skipEmpty?: boolean;
}
