import { camelize, isString } from "@daybrush/utils";
import {
    areaBlock,
    flockBlocks, closeTagBlock, convertBlocksToCode, convertInlineBlocksToCode,
    joinBlocks, LINE_BREAK_BLOCK, methodBlock, objectBlock, openTagBlock, propertyDeclarationBlock, textBlock, variableDeclarationBlock,
} from "../codeBlocks/CodeBlocks";
import { CodeBlock } from "../codeBlocks/types";
import { CodeTranspileResult } from "../CodeTranspileResult";
import { convertTemplate, makePlugin } from "../utils";

export const ANGULAR_COMPONENT_HTML = /*#__PURE__*/makePlugin("angular", (result: CodeTranspileResult) => {
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
                ref,
                attributes,
                events,
            } = node;

            if (isOpen) {
                const refName = ref.name;
                const attributeBlocks = [
                    ...attributes.map(attr => {
                        return textBlock(attr.dynamic ? `[${attr.name}]="${attr.value}"` : `${attr.name}="${attr.value}"`);
                    }),
                    ...events.map(ev => {
                        return textBlock(`@${ev.name}="${result.registerName(camelize(`on ${ev.name}`))}"`);
                    }),
                ];
                const openBlock = openTagBlock(`${target}${refName ? ` #${refName}` : ""}`, attributeBlocks);
                if (isClose) {
                    inlineBlocks.push(flockBlocks([openBlock, closeTagBlock(target)]));
                } else {
                    inlineBlocks.push(openBlock);
                }
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
}, {
    refName: ref => ref.name,
});

export const ANGULAR_COMPONENT_CODE = /*#__PURE__*/makePlugin("angular", (result: CodeTranspileResult) => {
    result.registerImport({
        specifiers: {
            Component: "Component",
        },
        module: "@angular/core",
    });

    const blocks: CodeBlock[] = [];
    const imports = result.getImportCodes();
    const howToUses = result.getHowToUses(true);
    const eventNodes = result.getEventNodes(true);

    eventNodes.forEach(node => {
        node.value.events.forEach(node => {
            result.registerMethod(node.name, {
                ...node,
                isArrow: false,
            });
        });
    });

    imports.forEach(({ code }) => {
        blocks.push(textBlock(code), LINE_BREAK_BLOCK);
    });
    blocks.push(LINE_BREAK_BLOCK);

    blocks.push(textBlock("@Component("));
    blocks.push(objectBlock({
        selector: `"app-root"`,
        templateUrl: `"./app.component.html"`,
        styleUrls: `["./app.component.css"]`,
    }));
    blocks.push(textBlock(")"));
    blocks.push(LINE_BREAK_BLOCK);
    blocks.push(areaBlock("export class AppComponent {", [
        ...result.variables.map(variable => {
            return propertyDeclarationBlock(variable.name, variable.defaultValue);
        }),
        LINE_BREAK_BLOCK,
        ...result.methods.map(method => {
            return flockBlocks([
                methodBlock(method.name, method.params, method.text, method.isArrow),
                LINE_BREAK_BLOCK,
            ]);
        }),
        LINE_BREAK_BLOCK,
    ], "}"));
    const code = convertBlocksToCode(
        blocks,
        result.indent,
    );
    return convertTemplate(code);
    // @Component({
    //     selector: 'app-root',
    //     templateUrl: "./app.component.html",
    //     styleUrls: ["./app.component.css"]
    // })
    // export class AppComponent {
    //     frame = {
    //         translate: [0,0],
    //         scale: [1,1],
    //     };
    //     onScaleStart(e) {
    //         e.set(this.frame.scale);
    //         e.dragStart && e.dragStart.set(this.frame.translate);
    //     }
    //     onScale(e) {
    //         const beforeTranslate = e.drag.beforeTranslate;

    //         this.frame.translate = beforeTranslate;
    //         this.frame.scale = e.scale;
    //         e.target.style.transform
    //             = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px)`
    //             + ` scale(${e.scale[0]}, ${e.scale[1]})`;
    //     }
    // }
}, {
    setter: (variable, value) => `this.${variable.name} = ${value};`,
});

export const ANGULAR_MODULE_CODDE = /*#__PURE__*/makePlugin("angular-module", (result: CodeTranspileResult) => {
    return [];
});
