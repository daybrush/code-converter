import CodeConverter, {
    findAttribute, convertClassSelector, addIndent,
    CodeTranspileResult, createNode, CodeConverterNode,
    CodeConverterNodeResult,
    CodeConverterHowToUse,
    CodeConvertOptions,
    textBlock,
    parenthesesnBlock,
    objectBlock,
    flockBlocks,
    convertBlocksToCode,
    optionBlock,
} from "../../src/";

export function createConverter(code: string, options?: CodeConvertOptions) {
    const converter = new CodeConverter(code, options);

    converter.addPathRule({
        framework: "react",
        rule: /react-moveable/g,
        module: "react-moveable",
    });
    converter.addHowToUse(HOW_TO_USE_VANILLA_INFINITE_VIEWER);
    converter.addHowToUse(HOW_TO_USE_VANILLA_MOVEABLE);
    converter.addHowToUse(HOW_TO_USE_ANGULAR_MOVEABLE);

    return converter;
}


export const HOW_TO_USE_VANILLA_INFINITE_VIEWER = {
    framework: "vanilla",
    component: "InfiniteViewer",
    imports: [{
        module: "infinite-viewer",
        specifiers: {
            "default": "InfiniteViewer",
        },
    }],
    html: (nodeResult: CodeConverterNodeResult) => {
        const rootNode = nodeResult.rootNode;
        const className = findAttribute(rootNode, "className");

        return createNode("div", {
            className,
            attributes: className ? [{ ...className, name: "class" }] : [],
            children: rootNode.children,
            parentNode: rootNode.parentNode,
        });
    },
    instance: (nodeResult: CodeConverterNodeResult) => {
        const viewerNode = nodeResult.rootNode;
        const viewportNode = viewerNode.children[0] as CodeConverterNode;

        const className = findAttribute(viewerNode, "className")!;
        const viewerClassSelector = convertClassSelector(className.value);
        const viewportClassSelector = convertClassSelector(viewportNode.className.value);

        const viewerName = viewerNode.ref.name || "viewer";
        const attributes = viewerNode.attributes;
        const events = viewerNode.events;
        const codeBlocks = [
            textBlock(`const ${viewerName} = new InfiniteViewer`),
            parenthesesnBlock([
                textBlock(`document.querySelector("${viewerClassSelector}")`),
                textBlock(`document.querySelector("${viewportClassSelector}")`),
                objectBlock(attributes.map(({ name, defaultValue }) => optionBlock(name, defaultValue))),
            ]),
            textBlock(`;\n`),
            flockBlocks(events.map(ev => textBlock(`${viewerName}.on("${ev.name}", ${ev.text});\n`))),
        ];
        return convertBlocksToCode(codeBlocks);
    },
};

export const HOW_TO_USE_VANILLA_MOVEABLE: CodeConverterHowToUse = {
    framework: "vanilla",
    component: "Moveable",
    imports: [
        {
            module: "moveable",
            specifiers: {
                "default": "Moveable",
            },
        },
    ],
    html: () => null,
    instance: (nodeResult: CodeConverterNodeResult, transpileResult: CodeTranspileResult) => {
        const moveableNode = nodeResult.rootNode;
        const containerNode = moveableNode.parentNode!;
        const classSelector = convertClassSelector(containerNode.className.value);
        const attributes = moveableNode.attributes;
        const events = moveableNode.events;
        const codes: string[] = [];
        const moveableName = moveableNode.ref.name || "moveable";

        const propertiesText = attributes.map(attr => {
            return `${attr.name}: ${attr.defaultValue},`;
        }).join("\n");

        codes.push(`const ${moveableName} = new Moveable(document.querySelector("${classSelector}"), {
${addIndent(propertiesText, { indent: transpileResult.indent })}
});\n`);

        events.forEach(event => {
            codes.push(`${moveableName}.on("${event.name}", ${event.text});`);
        });

        return codes.join("\n");
    },
};

export const HOW_TO_USE_ANGULAR_MOVEABLE: CodeConverterHowToUse = {
    framework: "angular",
    component: "Moveable",
    imports: [
        {
            module: "ngx-moveable",
            specifiers: {
                "NgxMoveableComponent": "NgxMoveableComponent",
            },
        },
    ],
    html: (nodeResult: CodeConverterNodeResult) => {
        const rootNode = nodeResult.rootNode;

        return createNode("ngx-moveable", {
            events: rootNode.events,
            attributes: rootNode.attributes,
            children: rootNode.children,
            parentNode: rootNode.parentNode,
        });
    },
    instance: (nodeResult: CodeConverterNodeResult, transpileResult: CodeTranspileResult) => {
        const moveableNode = nodeResult.rootNode;
        const containerNode = moveableNode.parentNode!;
        const classSelector = convertClassSelector(containerNode.className.value);
        const codes: string[] = [];
        const moveableName = moveableNode.ref.name || "moveable";

        const propertiesText = moveableNode.attributes.map(attr => {
            return `${attr.name}: ${attr.defaultValue},`;
        }).join("\n");

        codes.push(`const ${moveableName} = new Moveable(document.querySelector("${classSelector}"), {
${addIndent(propertiesText, { indent: transpileResult.indent })}
});\n`);

        moveableNode.events.forEach(event => {
            codes.push(`${moveableName}.on("${event.name}", ${event.text});`);
        });

        return codes.join("\n");
    },
};
