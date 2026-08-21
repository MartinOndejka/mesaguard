import { S as Severity } from './types-CTqZ4Vc9.js';

type Format = "text" | "markdown" | "json";
type FailOn = Severity | "none";
interface Arguments {
    command: "scan" | "help" | "version";
    projectPath: string;
    format: Format;
    output?: string;
    failOn: FailOn;
    color: boolean;
}
declare function parseArguments(argv: string[]): Arguments;
declare function run(argv: string[]): Promise<number>;

export { parseArguments, run };
