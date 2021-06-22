import {
    objectBlock, convertBlocksToCode, optionBlock,
    parenthesesnBlock, textBlock, areaBlock,
} from "../src/";
import * as CodeBlockResult1 from "./results/CodeBlockResult1.txt";
import * as CodeBlockResult2 from "./results/CodeBlockResult2.txt";

describe("test CodeBlocks", () => {
    it("test code1", () => {
        const codeBlocks = [
            textBlock(`const viewer = new InfiniteViewer`),
            parenthesesnBlock([
                textBlock(`document.querySelector(".a")`),
                textBlock(`document.querySelector(".b")`),
                objectBlock([
                    optionBlock("a", "b"),
                    optionBlock("addd", "b"),
                    optionBlock("a", "bsdsdsdsdsdsd"),
                    optionBlock("asdsd", "b"),
                    optionBlock("asdsd", "bsdsdsd"),

                ]),
            ]),
            textBlock(`;\n`),
        ];
        const code = convertBlocksToCode(codeBlocks, 4);

        expect(code).toBe(CodeBlockResult1);
    });
    it("test code2", () => {
        const codeBlocks = [
            areaBlock("class A {", [
                areaBlock("constructor() {", [
                ], "}"),
            ], "}\n"),
        ];
        const code = convertBlocksToCode(codeBlocks, 4);

        expect(code).toBe(CodeBlockResult2);
    });
});
