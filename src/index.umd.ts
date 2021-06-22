import CodeConverter, * as modules from "./index";

for (const name in modules) {
    (CodeConverter as any)[name] = (modules as any)[name];
}
export default CodeConverter;
