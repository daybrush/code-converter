import { CodeConverterPluginOptions } from "./types";
import { matchTextArea } from "./utils";

export const REACT_PLUGIN_OPTIONS: Required<CodeConverterPluginOptions> = {
    getterRef: ref => `${ref.originalName}.current!`,
    refName: ref => ref.originalName,
    setter: (variable, value) => `${variable.setter}(${value});`,
    findRef: ref => new RegExp(`${ref.originalName}\\.current[!]*`, "g"),
    findSetterArea: (text: string, setter: string) => matchTextArea(text, `${setter}(`, ");", true),
};
