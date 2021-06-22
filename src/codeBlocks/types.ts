export interface DefaultCodeBlock {
    maxLength?: number;
    isOpen?: boolean;
    isClose?: boolean;
    suffix?: string;
}
export interface TextCodeBlock extends DefaultCodeBlock {
    type: "text";
    value: string | CodeBlock[];
}
export interface GroupCodeBlock extends DefaultCodeBlock {
    type: "group";
    value: CodeBlock[];
    padding?: boolean;
    lastPadding?: boolean;
    area?: boolean;
    lastLineBreak?: boolean;
}
export type CodeBlock = TextCodeBlock | GroupCodeBlock;
