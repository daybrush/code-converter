
import builder from "@daybrush/builder";



export default builder([
    {
        name: "CodeConverter",
        input: "src/index.umd.ts",
        output: "./dist/code-converter.js",
        resolve: true,
    },
    {
        name: "CodeConverter",
        input: "src/index.umd.ts",
        output: "./dist/code-converter.min.js",
        resolve: true,
        uglify: true,
    },
    {
        input: "src/index.ts",
        output: "./dist/code-converter.esm.js",
        exports: "named",
        format: "es",
    },
    {
        input: "src/index.umd.ts",
        output: "./dist/code-converter.cjs.js",
        exports: "default",
        format: "cjs",
    },
]);
