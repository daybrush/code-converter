import { CodeTranspileResult } from "../CodeTranspileResult";
import { convertTemplate, makePlugin } from "../utils";

export const REACT_CODE = /*#__PURE__*/makePlugin("react", (result: CodeTranspileResult) => {
    const nextCode = result.convertPath();

    return convertTemplate(nextCode);
});
