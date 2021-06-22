import { createConverter } from "./utils/utils";
import * as code1 from "./cases/code1.txt";
import * as VanillaCodeResult from "./results/VanillaCodeResult.txt";
import * as VanillaHTMLResult from "./results/VanillaHTMLResult.txt";
import * as AngularComponentHTMLResult from "./results/AngularComponentHTMLResult.txt";
import {
    ANGULAR_COMPONENT_CODE, ANGULAR_COMPONENT_HTML,
    VANILLA_CODE, VANILLA_HTML,
} from "../src";

describe("utils", () => {
    it("test VANILLA_CODE", () => {
        const converter = createConverter(code1);
        const code = converter.convert(VANILLA_CODE);

        expect(code).toBe(VanillaCodeResult);
    });
    it("test VANILLA_HTML", () => {
        const converter = createConverter(code1);
        const code = converter.convert(VANILLA_HTML);

        expect(code).toBe(VanillaHTMLResult);
    });
    it("test ANGULAR_COMPONENT_HTML", () => {
        const converter = createConverter(code1);
        const code = converter.convert(ANGULAR_COMPONENT_HTML);

        expect(code).toBe(AngularComponentHTMLResult);
    });
    it("test ANGULAR_COMPONENT_CODE", () => {
        const converter = createConverter(code1);
        const code = converter.convert(ANGULAR_COMPONENT_CODE);

        console.log(code);
        // expect(code).toBe(AngularComponentHTMLResult);
    });
});
