export interface SummaryContext {
    rustc: string;
    cargo: string;
    program?: string;
    clippy: string;
}
export declare class CheckRunner {
    private readonly _workingDirectory;
    private readonly _annotations;
    private readonly _stats;
    constructor(workingDirectory?: string);
    tryPush(line: string): void;
    addSummary(context: SummaryContext): Promise<void>;
    private addAnnotation;
    private static annotationLevel;
    private static linesMsg;
}
