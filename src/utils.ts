/* eslint-disable no-cond-assign */

import {
    decamelize, isString, splitComma,
    splitText, OPEN_CLOSED_CHARACTERS, counter, find, isArray,
} from "@daybrush/utils";
import { CodeTranspileResult } from "./CodeTranspileResult";
import {
    CodeConverterMatchArea, CodeConverterMatchResult,
    CodeConverterNodeResult, CodeConverterNode,
    IndentOptions, CodeConverterVariable, CodeConverterNodeAttribute,
    CodeConverterNodeEvent, CodeConverterPlugin,
    CodeConverterPluginOptions,
    CodeConverterInlineNode,
} from "./types";

export function findAttribute(node: CodeConverterNode, target: string) {
    return find(node.attributes, ({ name }) => name === target);
}
export function matchTextOpen(text: string, open: string | RegExp, isContain?: boolean): CodeConverterMatchArea {
    const startIndex = isString(open) ? text.indexOf(open) : text.search(open);

    if (startIndex === - 1) {
        return {
            result: null,
            text: "",
            originalText: "",
        };
    }

    let nextText = text.slice(startIndex);
    const originalText = nextText.replace(open, "");

    if (!isContain) {
        nextText = originalText;
    }

    return {
        result: isString(open) ? null : open.exec(text),
        text: nextText,
        originalText,
    };
}

export function matchTextClose(text: string, close: string | RegExp, isContain?: boolean): CodeConverterMatchArea {
    const endIndex = isString(close) ? text.indexOf(close) : text.search(close);

    if (endIndex === -1) {
        return {
            result: null,
            text: "",
            originalText: "",
        };
    }
    const suffix = isString(close) ? [text.slice(endIndex, endIndex + close.length)] : text.match(close);
    const originalText = text.slice(0, endIndex);
    let nextText = originalText;

    if (isContain && suffix) {
        nextText += suffix[0];
    }

    return {
        result: isString(close) ? null : close.exec(text),
        text: nextText,
        originalText,
    };
}
export function matchTextArea(
    text: string,
    open: string | RegExp,
    close: string | RegExp,
    isContain?: boolean,
): CodeConverterMatchResult {
    const opener = matchTextOpen(text, open, isContain);
    const closer = matchTextClose(opener.text, close, isContain);
    const nextText = closer.text;

    return {
        opener,
        closer,
        text: nextText,
        originalText: isContain ? matchTextClose(opener.originalText, close).text : nextText,
    };
}
export function matchTextAreas(text: string, open: string | RegExp, close: string | RegExp, isContain?: boolean) {
    const areas: CodeConverterMatchResult[] = [];
    let nextText = text;

    while (nextText) {
        const area = matchTextArea(nextText, open, close, isContain);

        if (!area.text) {
            break;
        }
        areas.push(area);
        nextText = matchTextOpen(nextText, area.text).text;
    }
    return areas;
}
function matchProperties(text: string) {
    const regex = /(\S+): ([^,]+)/g;
    let result: RegExpExecArray | null;

    const properites: Array<{ name: string, value: string }> = [];
    while (result = regex.exec(text)) {
        properites.push({
            name: result[1],
            value: result[2],
        });
    }
    return properites;
}
function findIndent(text: string, isLast?: boolean) {
    const lines = text.split("\n");
    let spaceIndex = 0;

    if (isLast) {
        const lastLine = lines[lines.length - 1] || "";

        spaceIndex = Math.max(lastLine.search(/\S/g), 0);
    } else {
        spaceIndex = Math.max(text.search(/\S/g), 0);
    }
    return spaceIndex;
}
function removeIndent(text: string, spaceIndex: number) {
    const lines = text.split("\n");

    return lines.map(line => {
        const lineSpaceIndex = Math.max(line.search(/\S/g), 0);
        const nextSpaceIndex = Math.min(lineSpaceIndex, spaceIndex);

        return line.slice(nextSpaceIndex);
    }).join("\n");
}
function getStyle(text: string) {
    const value = matchProperties(text).map(property => {
        let value = property.value;
        const quote = value[0];

        if (quote === `"`) {
            value = value.slice(1, -1);
        }
        if (quote === "`") {
            value = value.slice(1, -1);

            matchTextAreas(value, /\${/g, /}/g, true).forEach(area => {
                const areaValue = area.text;

                value = value.replace(areaValue, areaValue.slice(2, -1));
            });
        }
        return `${decamelize(property.name, "-")}: ${value};`;
    }).join("");

    return {
        name: "style",
        value,
        defaultValue: value,
        originalValue: value,
        dynamic: false,
    };
}
export function getVariables(text: string): CodeConverterVariable[] {
    const regex = /const \[([^,\]]+)(?:, ([^\]]+))*\]\s*=\s*(?:React.)*useState/g;
    let result: RegExpExecArray | null;

    const variables: CodeConverterVariable[] = [];
    while (result = regex.exec(text)) {
        let defaultValue = (splitText(text.slice(result.index + result[0].length), {
            isSeparateFirst: true,
            isSeparateOnlyOpenClose: true,
            isSeparateOpenClose: true,
        })[0] || "").slice(1, -1);
        defaultValue = removeIndent(defaultValue, findIndent(defaultValue, true));
        const isFunction = defaultValue.search(/\(\)/g) >= 0;
        let value = defaultValue;

        if (isFunction) {
            const valueArea = matchTextArea(value, /\(\) => [(|{]/g, /;*\s*[}|)]$/g);

            value = valueArea.text.trim().replace("return", "");
            value = removeIndent(value, findIndent(value, true));
        }

        variables.push({
            name: result[1].replace(/Ref$/g, ""),
            originalName: result[1],
            setter: result[2] || "",
            value,
            defaultValue,
            isFunction,
        });
    }
    return variables;
}
function matchParams(text: string) {
    const area = matchTextArea(text, /[^\S+]*/g, /\s*=>/g);
    let paramsText = area.text;

    if (paramsText[0] === "(") {
        paramsText = paramsText.slice(1, -1);
    }
    return {
        area,
        params: splitComma(paramsText),
    };
}
function splitAttributes(text: string, isComponent?: boolean) {
    const ref = {
        name: "",
        originalName: "",
    };
    const eventAttributes: string[] = [];
    const attributeTexts = splitText(text, {
        separator: "",
        openCloseCharacters: [
            ...OPEN_CLOSED_CHARACTERS,
            { open: "{", close: "}" },
        ],
    });
    const attributes: CodeConverterNodeAttribute[] = attributeTexts.filter(attributeText => {
        if (attributeText.search(/on[A-Z]/g) === -1) {
            return true;
        }
        eventAttributes.push(attributeText);
        return false;
    }).map(attributeText => {
        const attributeArea = matchTextArea(
            attributeText,
            /([^=]+)=(["{])/g,
            /[}"]$/g,
        );
        const result = attributeArea.opener.result!;
        let name = result[1];
        let value = attributeArea.text;

        value = removeIndent(value, findIndent(value, true));

        if (name === "className" && !isComponent) {
            name = "class";
        }
        if (name === "style" && !isComponent) {
            return getStyle(attributeArea.text);
        }
        if (name === "ref") {
            ref.originalName = value;
            ref.name = value.replace(/Ref$/g, "");


            return {
                name: "",
                value: "",
                defaultValue: "",
                originalValue: "",
                dynamic: false,
            };
        }
        const dynamic = result[2] === "{";
        const defaultValue = dynamic ? value : `"${value}"`;

        return {
            name,
            value,
            defaultValue,
            originalValue: defaultValue,
            dynamic,
        };
    }).filter(({ name }) => name);

    const className: CodeConverterNodeAttribute = find(attributes, ({ name }) => name === "class") || {
        name: "class",
        value: "",
        defaultValue: "",
        originalValue: "",
        dynamic: false,
    };
    const events = eventAttributes.map(eventAttribute => {
        return getEvent(eventAttribute);
    });
    return {
        className,
        attributes,
        events,
        ref,
    };
}
export function createNode(target: string, status: Partial<CodeConverterNode>): CodeConverterNodeResult {
    const node = createCodeConverterNode(target, status);
    const inlineNodes = searchCodeConverterInlineNode(node);

    return {
        rootNode: node,
        inlineNodes,
    };
}
export function convertClassSelector(className: string) {
    return className.split(" ").map(name => `.${name}`).join("");
}
export function createCodeConverterNode(target: string, status: Partial<CodeConverterNode> = {}): CodeConverterNode {
    const isComponent = target.charCodeAt(0) <= 90;

    return {
        target,
        ref: { name: "", originalName: "" },
        attributes: [],
        events: [],
        children: [],
        inline: status.children?.length === 0,
        isComponent,
        parentNode: null,
        className: { name: "class", value: "", defaultValue: "", originalValue: "", dynamic: false },
        ...status,
    };
}
export function searchCodeConverterInlineNode(
    rootNode: CodeConverterNode,
    inlineNodes: CodeConverterInlineNode[] = [],
) {
    inlineNodes.push({
        type: "node",
        value: rootNode,
        isOpen: true,
        isClose: rootNode.inline,
    });

    if (rootNode.inline) {
        return inlineNodes;
    }
    rootNode.children.forEach(childNode => {
        if (isString(childNode)) {
            inlineNodes.push({
                type: "text",
                isOpen: false,
                isClose: false,
                value: childNode,
            });
        } else {
            searchCodeConverterInlineNode(childNode, inlineNodes);
        }
    });

    inlineNodes.push({
        type: "node",
        value: createCodeConverterNode(rootNode.target),
        isOpen: false,
        isClose: true,
    });
    return inlineNodes;
}
export function searchCodeConverterNode(inlineNodes: CodeConverterInlineNode[]) {
    const stack: CodeConverterNode[] = [];
    let currentNode: CodeConverterNode;

    inlineNodes.forEach(inlineNode => {
        const {
            type,
            isOpen,
            isClose,
            value,
        } = inlineNode;


        if (currentNode && (!isClose || isOpen)) {
            currentNode.children.push(value!);
        }
        if (type === "node") {
            const nextNode = value as CodeConverterNode;

            nextNode.parentNode = currentNode;
            if (isOpen) {
                nextNode.children = [];

                if (!isClose) {
                    stack.push(nextNode);
                    currentNode = nextNode;
                }
            } else if (isClose) {
                stack.pop();
                currentNode = stack[stack.length - 1];
            }
        }
    });

    return inlineNodes[0].value as CodeConverterNode;
}

export function analyzeReactFunctionCode(text: string): CodeConverterNodeResult {
    const htmls = splitText(text, {
        isSeparateOnlyOpenClose: true,
        isSeparateOpenClose: true,
        openCloseCharacters: [
            ...OPEN_CLOSED_CHARACTERS,
            { open: "<", close: ">", ignore: /=>|\s>\s|\s<\s/g },
        ],
    });

    const inlineNodes = htmls.map(text => {
        const openArea = matchTextOpen(text, /^<([a-zA-Z0-9]+)/g);
        const closeArea = matchTextOpen(text, /(?:^<\/([a-zA-Z0-9]+))|(?:\/>$)/g);
        const openResult = openArea.result;
        const closeResult = closeArea.result;
        const target = openResult?.[1] ?? (closeResult?.[1] ?? "");
        const isOpen = !!openArea.result;
        const isClose = !!closeArea.result;


        if (isOpen) {
            const isComponent = target.charCodeAt(0) <= 90;
            const attributesArea = matchTextClose(openArea.text, /\/?>$/g);

            const nextNode = createCodeConverterNode(target, {
                ...splitAttributes(attributesArea.text, isComponent),
                inline: isClose,
            });
            return {
                type: "node",
                value: nextNode,
                isOpen,
                isClose,
            };
        } else if (isClose) {
            return {
                type: "node",
                value: createCodeConverterNode(target),
                isOpen: false,
                isClose: true,
            };
        } else if (text.trim()) {
            // text node
            return {
                type: "text",
                value: text.trim(),
                isOpen: false,
                isClose: false,
            };
        } else {
            return null;
        }
    }).filter(node => node) as CodeConverterInlineNode[];

    const rootNode = searchCodeConverterNode(inlineNodes);

    return {
        rootNode: rootNode!,
        inlineNodes,
    };
}

function getEvent(text: string): CodeConverterNodeEvent {
    const eventArea = matchTextArea(text, /([A-Z][^=]+)=\{/mg, /([}a-zA-Z0-9])\}/g, true);
    const eventResult = eventArea.opener.result;
    const eventText = eventArea.originalText;

    if (!eventResult) {
        return {
            name: "",
            params: [],
            paramsArea: null,
            text: "",
            isFunction: false,
        };
    }
    const {
        params,
        area: paramsArea,
    } = matchParams(eventText);
    let funcText = `${eventText}${eventArea.closer.result![1]}`;

    funcText = removeIndent(funcText, findIndent(funcText, true));

    return {
        name: eventResult[1].replace(/^([A-Z])/, (_, firstLetter) => {
            return firstLetter.toLowerCase();
        }),
        params,
        paramsArea,
        text: funcText,
        isFunction: !!paramsArea,
    };
}
export function addIndent(text: string, options: IndentOptions) {
    const {
        indent = 4,
        startIndent = indent,
        endIndent = indent,
        skipEmpty,
    } = options;
    const startIndentText = counter(startIndent).map(() => " ").join("");
    const indentText = counter(indent).map(() => " ").join("");
    const endIndentText = counter(endIndent).map(() => " ").join("");
    const texts = text.split("\n");
    const length = texts.length;

    return texts.map((line, i) => {
        if (skipEmpty && !line) {
            return "";
        }
        let nextIndentText = indentText;

        if (i === 0) {
            nextIndentText = startIndentText;
        } else if (i === length - 1) {
            nextIndentText = endIndentText;
        }
        return `${nextIndentText}${line}`;
    }).join("\n");
}
export function analyzeReactFunctionCodeToHTML(inlineNodes: CodeConverterInlineNode[], indent = 4) {
    let depth = -1;

    return inlineNodes.map(result => {
        const {
            type,
            isOpen,
            isClose,
        } = result;
        if (isOpen || type === "text") {
            ++depth;
        }
        const nextIndent = depth * indent;
        const node = result.value;
        let line = "";
        if (isString(node)) {
            line = node.trim();

            if (line) {
                line = addIndent(line, {
                    indent: nextIndent,
                });
            }
        } else {
            const {
                target,
                attributes,
            } = node;

            if (isOpen) {
                line = addIndent(`<${target}`, {
                    indent: nextIndent,
                });
                if (attributes.length) {
                    const texts = attributes.map(attr => {
                        return `${attr.name}="${attr.value}"`;
                    });
                    const totalLength = texts.reduce((prev, cur) => {
                        return prev + cur.length;
                    }, 0);
                    const isBreak = totalLength > 200;
                    const breakCharacter = isBreak ? "\n" : " ";

                    line += addIndent(breakCharacter + texts.join(breakCharacter) + (isClose ? "/>" : ">"), {
                        startIndent: 0,
                        indent: nextIndent + indent,
                    });
                } else {
                    line += isClose ? " />" : "";
                }
            } else if (isClose) {
                line = addIndent(`</${target}>`, {
                    indent: nextIndent,
                });
            }
        }
        if (isClose || type === "text") {
            --depth;
        }
        return line;
    }).filter(text => text).join("\n");
}
export function convertTemplate(text: string, regex = /props\.([a-zA-Z0-9_]+)/g, includePrefix = false) {
    const previewText = text.replace(/App\([^)]*\)/g, "App()");
    let result: RegExpExecArray | null;
    let index = 0;

    const strings: string[] = [];
    const values: string[] = [];

    // eslint-disable-next-line no-cond-assign
    while (result = regex.exec(previewText)) {
        const nextIndex = result.index + (includePrefix ? result[0].lastIndexOf(result[2]) : 0);

        strings.push(previewText.slice(index, nextIndex));
        values.push(result[1]);
        index = nextIndex + (includePrefix ? result[2].length : result[0].length);
    }

    strings.push(previewText.slice(index));
    return [strings, values];
}

export function makePlugin(
    framework: string, plugin: (result: CodeTranspileResult) => any,
    options: Partial<CodeConverterPluginOptions> = {},
): CodeConverterPlugin {
    (plugin as CodeConverterPlugin).framework = framework;
    (plugin as CodeConverterPlugin).options = options;
    return plugin as CodeConverterPlugin;
}


export function convertArrayTemplate([strings, values]: [string[], any[]], props: Record<string, any>) {
    return strings.reduce((prev, next, i) => {
        let name = values[i];

        if (typeof name === "undefined") {
            name = "";
        }
        let value: any = name;

        if (name) {
            if (typeof name === "function") {
                try {
                    value = name(props);
                    // eslint-disable-next-line no-empty
                } catch (e) { }
            }
            if (Array.isArray(name)) {
                value = convertArrayTemplate(name as any, props);
            } else if (name in props) {
                value = JSON.stringify(props[name]);
            }
        }
        return prev + next + value;
    }, "");
}


export function filterFramework<T extends { framework?: string | string[] }>(arr: T[], targetFramework: string) {
    return arr.filter(({ framework }) => {
        return !framework
            || framework === targetFramework
            || (isArray(framework) && framework.indexOf(targetFramework) >= 0);
    });
}
