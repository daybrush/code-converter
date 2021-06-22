import { counter, findIndex, findLastIndex, isArray } from "@daybrush/utils";
import { addIndent } from "../utils";
import { CodeBlock, GroupCodeBlock, TextCodeBlock } from "./types";

export const LINE_BREAK_BLOCK = /*#__PURE__*/ textBlock("\n");
export const EMPTY_BLOCK = /*#__PURE__*/ textBlock("");
export const COMMA_BLOCK = /*#__PURE__*/ textBlock(",");


export function textBlock(text: string, block: Partial<TextCodeBlock> = {}): CodeBlock {
    return {
        type: "text",
        value: text,
        ...block,
    };
}
export function convertgroupBlockToCode(block: GroupCodeBlock, indent = 4) {
    const {
        padding,
        value: blocks,
        maxLength = 0,
        area,
        suffix = ",",
        lastPadding = padding,
        lastLineBreak = true,
    } = block;
    const contentBlocks = blocks.slice(1, -1);
    const openBlock = blocks[0];
    const closeBlock = blocks[blocks.length - 1];
    const startPaddingBlock = textBlock(padding ? " " : "");
    const endPaddingBlock = textBlock(lastPadding ? " " : "");

    if (area) {
        const hasContents = contentBlocks.length;
        return convertBlocksToCode([
            openBlock,
            hasContents ? LINE_BREAK_BLOCK : EMPTY_BLOCK,
            mergeBlocks(contentBlocks, indent, 1),
            LINE_BREAK_BLOCK,
            closeBlock,
        ]);
    }
    const suffixBlock = textBlock(suffix);
    let code = area ? "" : convertBlocksToCode([
        openBlock,
        startPaddingBlock,
        ...joinBlocks(contentBlocks, ["$", suffixBlock, textBlock(" "), "$"]),
        endPaddingBlock,
        closeBlock,
    ], indent);
    if (maxLength && code.length > maxLength) {

        const nextBlocks = joinBlocks(
            contentBlocks.map(block => mergeBlocks([block, suffixBlock], indent, 1)),
            [LINE_BREAK_BLOCK, "$"],
        );
        code = convertBlocksToCode([
            openBlock,
            ...nextBlocks,
            lastLineBreak ? LINE_BREAK_BLOCK : EMPTY_BLOCK,
            closeBlock,
        ]);
    }
    return code;
}
export function mergeBlocks(blocks: CodeBlock[], indent: number = 4, depth = 0): CodeBlock {
    return textBlock(convertBlocksToCode(blocks, indent, depth));
}
export function openTagBlock(target: string, blocks: CodeBlock[], inline?: boolean): CodeBlock {
    return {
        type: "group",
        maxLength: 100,
        suffix: "",
        padding: true,
        lastPadding: false,
        lastLineBreak: false,
        value: [
            textBlock(`<${target}`),
            ...blocks,
            textBlock(inline ? "/>" : ">"),
        ],
        isOpen: true,
        isClose: inline,
    };
}
export function closeTagBlock(target: string) {
    return {
        ...textBlock(`</${target}>`),
        isClose: true,
    };
}
export function convertInlineBlocksToCode(blocks: CodeBlock[], indent = 4): string {
    let depth = 0;
    const result = blocks.map(block => {
        if (block.isOpen == block.isClose) {
            return convertBlocksToCode([block], indent, depth);
        }
        if (block.isClose) {
            --depth;
        }
        const code = convertBlocksToCode([block], indent, depth);

        if (block.isOpen) {
            ++depth;
        }
        return code;
    }).join("");

    return result;
}
export function convertBlocksToCode(blocks: CodeBlock[], indent = 4, depth = 0): string {
    const result = blocks.map(block => {
        if (block.type === "group") {
            return convertgroupBlockToCode(block, indent);
        } else if (isArray(block.value)) {
            return convertBlocksToCode(block.value, indent);
        }
        return block.value;
    }).join("");

    return result ? addIndent(result, { indent: indent * depth, skipEmpty: true }) : "";
}
export function parenthesesnBlock(blocks: CodeBlock[]): CodeBlock {
    return {
        type: "group",
        maxLength: 50,
        value: [
            textBlock("("),
            ...blocks,
            textBlock(")"),
        ],
    };
}

export function objectBlock(blocks: CodeBlock[] | Record<string, any>): CodeBlock {
    const nextBlocks = isArray(blocks) ? blocks : Object.keys(blocks).map(name => optionBlock(name, blocks[name]));
    return {
        type: "group",
        maxLength: 50,
        padding: true,
        value: [
            textBlock("{"),
            ...nextBlocks,
            textBlock("}"),
        ],
    };
}

export function groupBlock(
    openCharacter: string,
    blocks: CodeBlock[],
    closeCharacter: string,
    block: Partial<GroupCodeBlock> = {},
): CodeBlock {
    return {
        type: "group",
        value: [
            textBlock(openCharacter),
            ...blocks,
            textBlock(closeCharacter),
        ],
        ...block,
    };
}
export function areaBlock(
    openCharacter: string,
    blocks: CodeBlock[],
    closeCharacter: string,
): CodeBlock {
    return groupBlock(openCharacter, blocks, closeCharacter, {
        area: true,
    });
}
export function joinBlocks(blocks: CodeBlock[], joinBlocks: Array<CodeBlock | "$">): CodeBlock[] {
    const left = findIndex(joinBlocks, block => block === "$");
    const right = findLastIndex(joinBlocks, block => block === "$");
    const isCenter = left !== right;

    // 0 1 2
    const nextBlocks: CodeBlock[] = [];

    blocks.forEach((block, i) => {
        if (isCenter) {
            if (i !== 0) {
                nextBlocks.push(...joinBlocks.filter(joinBlock => joinBlock !== "$") as CodeBlock[]);
            }
            nextBlocks.push(block);
        } else {
            joinBlocks.forEach(joinBlock => {
                if (joinBlock === "$") {
                    nextBlocks.push(block);
                } else {
                    nextBlocks.push(joinBlock);
                }
            });
        }
    });
    return nextBlocks;
}
export function indentBlock(indent: number): CodeBlock {
    return textBlock(counter(indent).map(() => " ").join(""));
}
export function optionBlock(name: string, value: string): CodeBlock {
    return {
        type: "text",
        value: `${name}: ${value}`,
    };
}
export function variableDeclarationBlock(type: "var" | "let" | "const", name: string, defaultValue?: string) {
    return textBlock(`${type} ${name}${defaultValue ? ` = ${defaultValue}` : ""};`);
}
export function propertyDeclarationBlock(name: string, defaultValue?: string) {
    return textBlock(`${name}${defaultValue ? ` = ${defaultValue}` : ""};`);
}
export function methodBlock(name: string, params: string[], text: string, isArrow?: boolean) {
    if (isArrow) {
        return areaBlock(`${name} = (${params.join(", ")}) => {`, [
            textBlock(text),
        ], "}");
    } else {
        return areaBlock(`${name}(${params.join(", ")}) {`, [
            textBlock(text),
        ], "}");
    }
}
export function flockBlocks(blocks: CodeBlock[], block: Partial<TextCodeBlock> = {}): CodeBlock {
    return {
        type: "text",
        value: blocks,
        ...block,
    };
}
