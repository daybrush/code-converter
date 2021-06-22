/* eslint-disable no-cond-assign */
import { find, splitComma } from "@daybrush/utils";
import { convertBlocksToCode, objectBlock, textBlock } from "./codeBlocks/CodeBlocks";
import { REACT_PLUGIN_OPTIONS } from "./consts";
import {
    CodeConverterHowToUse, CodeConverterImport, CodeConverterStatus,
    CodeConverterVariable, CodeConverterInlineNode, CodeConverterNode,
    CodeConverterNodeResult, CodeConverterPlugin,
    CodeConverterPluginOptions,
    CodeConverterMethod,
} from "./types";
import {
    analyzeReactFunctionCode, filterFramework, getVariables, matchTextArea,
    matchTextAreas,
    searchCodeConverterInlineNode,
} from "./utils";

export class CodeTranspileResult {
    public nodeResult!: CodeConverterNodeResult;
    public imports: CodeConverterImport[] = [];
    public variables: CodeConverterVariable[] = [];
    public methods: CodeConverterMethod[] = [];
    public pluginOptions: Required<CodeConverterPluginOptions>;
    public framework = "";
    constructor(public plugin: CodeConverterPlugin, options: CodeConverterStatus) {
        this.pluginOptions = {
            ...REACT_PLUGIN_OPTIONS,
            ...plugin.options,
        };
        this.framework = plugin.framework;
        for (const name in options) {
            (this as any)[name] = (options as any)[name];
        }
        this.setCode(this.code);
    }
    public setCode(code: string) {
        const htmlArea = matchTextArea(code, /([ ]*)return \((?:\n([ ]*))*/g, /\);\n}/mg);
        const importAreas = matchTextAreas(code, /import\s/g, /\s*from "([^"]+)";/, true);

        this.variables = getVariables(code);
        this.nodeResult = analyzeReactFunctionCode(htmlArea.text);

        const refNodes = this.getRefNodes();


        this.nodeResult.inlineNodes.forEach(node => {
            if (node.type === "text") {
                // node
            } else {
                const subNode = node.value as CodeConverterNode;

                subNode.events.forEach(ev => {
                    ev.text = this.replaceRefVariables(ev.text, refNodes);
                    ev.text = this.replaceSetter(ev.text);
                });
                subNode.attributes.forEach(attr => {
                    if (!attr.dynamic) {
                        return;
                    }
                    attr.value = this.replaceRefVariables(attr.value, refNodes);
                    attr.defaultValue = this.replaceRefVariables(attr.defaultValue, refNodes);
                });
            }
        });
        this.code = code;

        this.imports = importAreas.map(area => {
            const text = area.originalText;
            const specifiers: Record<string, string> = {};

            function searchSpecifiers(texts: string[], isRoot?: boolean) {
                texts.forEach(subText => {
                    const firstLetter = subText[0];

                    if (firstLetter === "{") {
                        // { aa, bb, cc }
                        searchSpecifiers(splitComma(subText.slice(1, -1)));
                    }
                    let [name, asName = name] = subText.split(/\s*as\s*/g);

                    name = name.trim();
                    asName = asName.trim();

                    if (!name) {
                        return;
                    }
                    if (isRoot && name !== "*") {
                        specifiers.default = name;
                    } else {
                        specifiers[name] = asName;
                    }
                });
            }
            searchSpecifiers(splitComma(text), true);

            return {
                text: area.text,
                specifiers,
                module: area.closer.result![1],
                framework: "react",
            };
        });

    }
    public convertPath() {
        const framework = this.framework;
        const imports = this.imports;
        const pathRules = this.pathRules.filter(rule => rule.framework === framework);
        let nextCode = this.code;

        imports.forEach(importInfo => {
            const importText = importInfo.text!;
            const importPath = importInfo.module;

            pathRules.forEach(pathRule => {
                if (importPath.search(new RegExp(pathRule.rule)) >= 0) {
                    const nextImportText = importText.replace(importPath, pathRule.module);

                    nextCode = nextCode.replace(importText, nextImportText);
                }
            });
        });

        return nextCode;
    }
    public findHowToUse(component: string) {
        const framework = this.framework;

        return find(this.howToUses, howToUse => {
            return howToUse.component === component && howToUse.framework === framework;
        });
    }
    public getHowToUses(isCode?: boolean): Array<{ code: string, howToUse: CodeConverterHowToUse }> {
        const inlineNodes = this.nodeResult.inlineNodes.filter(node => {
            return node.isOpen && node.type === "node" && (node.value as CodeConverterNode).isComponent;
        }) as Array<CodeConverterInlineNode<CodeConverterNode>>;

        return inlineNodes.map(node => {
            const howToUse = this.findHowToUse((node.value as CodeConverterNode).target)!;
            let code = "";

            if (isCode && howToUse && howToUse.instance) {
                code = howToUse.instance({
                    rootNode: node.value,
                    inlineNodes: searchCodeConverterInlineNode(node.value),
                }, this);
            }
            return {
                code,
                howToUse,
            };
        }).filter(howToUse => howToUse.howToUse);
    }
    public getEventNodes(isContainComponent?: boolean) {
        return this.nodeResult.inlineNodes.filter(({ type, value }) => {
            return type === "node"
                && (isContainComponent == (value as CodeConverterNode).isComponent)
                && (value as CodeConverterNode).events.length;
        }) as Array<CodeConverterInlineNode<CodeConverterNode>>;
    }
    public getRefNodes() {
        return this.nodeResult.inlineNodes.filter(({ type, value }) => {
            return type === "node" && (value as CodeConverterNode).ref.name;
        }) as Array<CodeConverterInlineNode<CodeConverterNode>>;
    }
    public registerImport(importInfo: Partial<CodeConverterImport>) {
        this.imports.push({
            specifiers: {},
            framework: this.framework,
            module: "",
            ...importInfo,
        });
    }
    public registerName(targetName: string) {
        const variables = this.variables;
        const methods = this.methods;
        const refNodes = this.getRefNodes();

        const names = [
            ...variables.map(variable => variable.name),
            ...methods.map(method => method.name),
            ...refNodes.map(node => node.value.ref.name),
        ];

        for (let i = 1; i < 100; ++i) {
            const nextName = i === 1 ? targetName : `${targetName}${i}`;

            if (!find(names, name => name === nextName)) {
                return nextName;
            }
        }
        return "";

    }
    public registerMethod(methodName: string, method: CodeConverterMethod) {
        const name = this.registerName(methodName);

        this.methods.push({
            ...method,
            name,
        });
        return name;
    }
    public registerVariable(targetName: string, options: Partial<CodeConverterVariable> = {}) {
        const name = this.registerName(targetName);

        const variables = this.variables;

        const {
            originalName = name,
            value = "",
            defaultValue = value,
            setter = "",
            isFunction = false,
        } = options;

        variables.push({
            name,
            originalName,
            value,
            defaultValue,
            setter,
            isFunction,
        });

        return name;
    }
    public replaceSetter(text: string) {
        let nextText = text;
        const variables = this.variables;
        const {
            setter,
        } = this.pluginOptions;

        variables.forEach(variable => {
            const variableSetter = variable.setter;
            if (variableSetter) {
                const area = REACT_PLUGIN_OPTIONS.findSetterArea(nextText, variableSetter);

                if (area.text) {
                    nextText = nextText.replace(area.text, setter(variable, area.originalText));
                }
            }
        });
        return nextText;
    }
    public replaceRefVariables(text: string, refNodes = this.getRefNodes()) {
        const {
            getterRef,
            refName,
        } = this.pluginOptions;
        let nextText = text;

        refNodes.forEach(node => {
            const ref = node.value.ref;

            nextText = nextText.replace(REACT_PLUGIN_OPTIONS.findRef(ref), getterRef(ref));
            nextText = nextText.replace(REACT_PLUGIN_OPTIONS.refName(ref), refName(ref));
        });
        return nextText;
    }
    public getImportCodes() {
        const totalImports: Record<string, Record<string, string>> = {};
        const howToUses = this.getHowToUses();

        function registerImports(imports: CodeConverterImport[]) {
            imports.forEach(({ module, specifiers }) => {
                if (!totalImports[module]) {
                    totalImports[module] = {};
                }
                const totalSpecifiers = totalImports[module];

                for (const specifierName in specifiers) {
                    totalSpecifiers[specifierName] = specifiers[specifierName];
                }
            });
        }

        registerImports(filterFramework(this.imports, this.framework));
        howToUses.forEach(({ howToUse }) => {
            registerImports(howToUse.imports);
        });

        const importCodes: Array<{ code: string, module: string }> = [];

        for (const module in totalImports) {
            const specifiers = totalImports[module];
            const codes: string[] = [];
            const defaultCode = specifiers.default;
            const allSpecifier = specifiers["*"];
            const specifierCodes: string[] = [];

            for (const name in specifiers) {
                if (name === "*" || name === "default") {
                    continue;
                }
                const value = specifiers[name];
                specifierCodes.push(name === value ? name : `${name} as ${value}`);
            }
            if (allSpecifier) {
                importCodes.push({
                    code: `import * as ${allSpecifier} from "${module}";`,
                    module,
                });
            }
            if (defaultCode) {
                codes.push(defaultCode);
            }
            if (specifierCodes.length) {
                codes.push(convertBlocksToCode([
                    objectBlock(specifierCodes.map(code => textBlock(code))),
                ], this.indent));
            }

            if (codes.length) {
                importCodes.push({
                    code: `import ${codes.join(", ")} from "${module}";`,
                    module,
                });
            }
        }
        return importCodes;
    }
    public searchNodes(
        callback: (inlineNode: CodeConverterInlineNode) => void,
        isSearchHowToUse?: boolean,
    ) {

        const inlineNodes = this.nodeResult.inlineNodes;
        let i = 0;
        let inlineNode = inlineNodes[i];

        while (inlineNode = inlineNodes[i]) {
            const type = inlineNode.type;
            const value = inlineNode.value as CodeConverterNode;

            if (type === "node" && value.isComponent && isSearchHowToUse) {
                const howToUse = this.findHowToUse(value.target);

                if (howToUse && howToUse.html) {
                    const componentInlineNodes = searchCodeConverterInlineNode(value);
                    const length = componentInlineNodes.length;
                    const prevResult = {
                        rootNode: value,
                        inlineNodes: componentInlineNodes,
                    };
                    const nextResult = howToUse.html(prevResult, this);

                    if (!nextResult) {
                        inlineNodes.splice(i, length);
                        continue;
                    } else if (prevResult !== nextResult) {
                        const nextInlineNodes = nextResult.inlineNodes;
                        inlineNodes.splice(i, length, ...nextInlineNodes);
                        inlineNode = nextInlineNodes[0];
                    }
                }
            }
            callback(inlineNode);
            ++i;
        }
    }
}
export interface CodeTranspileResult extends CodeConverterStatus { }
