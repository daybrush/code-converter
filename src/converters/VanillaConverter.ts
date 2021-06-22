import { camelize, isString } from "@daybrush/utils";
import {
    closeTagBlock, joinBlocks, LINE_BREAK_BLOCK,
    convertInlineBlocksToCode, openTagBlock, textBlock, EMPTY_BLOCK, variableDeclarationBlock, convertBlocksToCode,
} from "../codeBlocks/CodeBlocks";
import { CodeBlock } from "../codeBlocks/types";
import { CodeTranspileResult } from "../CodeTranspileResult";
import { CodeConverterRef, CodeConverterVariable } from "../types";
import {
    convertClassSelector, convertTemplate,
    findAttribute, makePlugin,
} from "../utils";

export const VANILLA_HTML = /*#__PURE__*/makePlugin("vanilla", (result: CodeTranspileResult) => {
    const inlineBlocks: CodeBlock[] = [];

    result.searchNodes(inlineNode => {
        const {
            isOpen,
            isClose,
        } = inlineNode;
        const node = inlineNode.value;

        if (isString(node)) {
            inlineBlocks.push(textBlock(node));
        } else if (node) {
            const {
                target,
                attributes,
                events,
                isComponent,
                className,
            } = node;

            if (!isComponent && events.length && !className.value) {
                throw new Event("Specify the class of the target where the event is located.");
            }

            if (isOpen) {
                inlineBlocks.push(openTagBlock(target, attributes.map(attr => {
                    return textBlock(`${attr.name}="${attr.value}"`);
                }), isClose));
            } else if (isClose) {
                inlineBlocks.push(closeTagBlock(target));
            }
        }
    }, true);
    const code = convertInlineBlocksToCode(
        joinBlocks(inlineBlocks, ["$", LINE_BREAK_BLOCK, "$"]),
        result.indent,
    );
    return convertTemplate(code);
});

export const VANILLA_CODE = /*#__PURE__*/makePlugin("vanilla", (result: CodeTranspileResult) => {
    const eventNodes = result.getEventNodes();
    const variables = result.variables;
    const imports = result.getImportCodes();
    const howToUses = result.getHowToUses(true);

    const elementRefNodes = result.getRefNodes().filter(node => !node.value.isComponent);

    const eventVariables = eventNodes.map(node => {
        const ref = node.value.ref;

        if (ref.name) {
            return ref.name;
        }
        const className = node.value.className.value;

        return result.registerVariable(camelize(className), {
            value: `document.querySelector("${convertClassSelector(className)}")`,
        });
    });
    const blocks: CodeBlock[] = [];

    imports.forEach(({ code }) => {
        blocks.push(textBlock(code));
    });
    if (imports.length) {
        blocks.push(EMPTY_BLOCK);
    }

    variables.forEach(({ name, value, setter }) => {
        blocks.push(variableDeclarationBlock(setter ? "let" : "const", name, value));
    });
    elementRefNodes.forEach(({ value }) => {
        const refName = value.ref.name;
        const classAttribute = findAttribute(value, "class");

        if (!classAttribute) {
            throw new Error(`Specify className: ${value.ref}`);
        }
        blocks.push(variableDeclarationBlock(
            "const", refName, `document.querySelector("${convertClassSelector(classAttribute.value)}")`,
        ));
    });
    if (variables.length || elementRefNodes.length) {
        blocks.push(EMPTY_BLOCK);
    }

    howToUses.forEach(({ code }) => {
        blocks.push(textBlock(code));
    });
    if (howToUses.length) {
        blocks.push(EMPTY_BLOCK);
    }

    eventVariables.forEach((variableName, i) => {
        eventNodes[i].value.events.forEach(ev => {
            blocks.push(textBlock(`${variableName}.addEventListener("${ev.name}", ${ev.text});`));
        });
    });
    const code = convertBlocksToCode(
        joinBlocks(blocks, ["$", LINE_BREAK_BLOCK, "$"]),
        result.indent,
    );
    return convertTemplate(code);
}, {
    setter: (variable: CodeConverterVariable, value: string) => `${variable.name} = ${value};`,
    getterRef: (ref: CodeConverterRef) => ref.name,
    refName: (ref: CodeConverterRef) => ref.name,
});
