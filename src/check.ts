import * as core from '@actions/core';

interface CargoMessage {
  reason: string;
  message: {
    code: string;
    level: string;
    message: string;
    rendered: string;
    spans: DiagnosticSpan[];
  };
}

interface DiagnosticSpan {
  file_name: string;
  is_primary: boolean;
  line_start: number;
  line_end: number;
  column_start: number;
  column_end: number;
}

type FileName = string;
type AnnotationLevel = 'notice' | 'warning' | 'error';

interface FileAnnotation {
  title: string;
  level: AnnotationLevel;
  beginLine: number;
  endLine: number;
  beginColumn?: number;
  endColumn?: number;
  content: string;
}

type FileAnnotations = Array<FileAnnotation>;

export interface SummaryContext {
  rustc: string;
  cargo: string;
  clippy: string;
}

interface Stats {
  ice: number;
  error: number;
  warning: number;
  note: number;
  help: number;
}

export class CheckRunner {
  private _workingDirectory: string;
  private _annotations: Record<FileName, FileAnnotations>;
  private _stats: Stats;

  constructor(workingDirectory?: string) {
    this._workingDirectory = workingDirectory ? `${workingDirectory}/` : '';
    this._annotations = {};
    this._stats = {
      ice: 0,
      error: 0,
      warning: 0,
      note: 0,
      help: 0,
    };
  }

  public tryPush(line: string): void {
    let contents: CargoMessage;
    try {
      contents = JSON.parse(line);
    } catch (error) {
      core.debug('Not JSON, ignoring it');
      return;
    }

    if (contents.reason != 'compiler-message') {
      core.debug(`Unexpected reason field, ignoring it: ${contents.reason}`);
      return;
    }

    if (contents.message.code === null) {
      core.debug('Message code is missing, ignoring it');
      return;
    }

    switch (contents.message.level) {
      case 'help':
        this._stats.help += 1;
        break;
      case 'note':
        this._stats.note += 1;
        break;
      case 'warning':
        this._stats.warning += 1;
        break;
      case 'error':
        this._stats.error += 1;
        break;
      case 'error: internal compiler error':
        this._stats.ice += 1;
        break;
      default:
        break;
    }

    this.addAnnotation(contents);
  }

  public async addSummary(context: SummaryContext): Promise<void> {
    core.info(`Clippy results: \
${this._stats.ice} ICE, ${this._stats.error} errors, \
${this._stats.warning} warnings, ${this._stats.note} notes, \
${this._stats.help} help`);

    // Add all the annotations now. It is limited to 10, but it's better than nothing.
    // All annotations will also be included in the summary, below.
    // For more information, see https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28
    for (const [fileName, annotations] of Object.entries(this._annotations)) {
      for (const annotation of annotations) {
        const properties: core.AnnotationProperties = {
          title: annotation.title,
          file: fileName,
          startLine: annotation.beginLine,
          endLine: annotation.endLine,
        };
        if (annotation.beginColumn) {
          properties.startColumn = annotation.beginColumn;
        }
        if (annotation.endColumn) {
          properties.endColumn = annotation.endColumn;
        }

        switch (annotation.level) {
          case 'notice':
            core.notice(annotation.content, properties);
            break;
          case 'warning':
            core.warning(annotation.content, properties);
            break;
          default:
            core.error(annotation.content, properties);
            break;
        }
      }
    }

    // Now generate the summary with all annotations included.
    core.summary.addHeading('Results').addTable([
      [
        { data: 'Message level', header: true },
        { data: 'Amount', header: true },
      ],
      ['Internal compiler error', `${this._stats.ice}`],
      ['Error', `${this._stats.error}`],
      ['Warning', `${this._stats.warning}`],
      ['Note', `${this._stats.note}`],
      ['Help', `${this._stats.help}`],
    ]);

    for (const [fileName, annotations] of Object.entries(this._annotations)) {
      const content: string = annotations
        .map((annotation) => {
          const linesMsg: string = CheckRunner.linesMsg(
            annotation.beginLine,
            annotation.endLine,
          );

          return `${linesMsg}\n\n\`\`\`\n${annotation.content}\n\`\`\`\n`;
        })
        .join('\n');

      core.summary.addDetails(fileName, content);
    }

    return core.summary
      .addHeading('Versions')
      .addList([context.rustc, context.cargo, context.clippy])
      .write()
      .then((_summary) => {});
  }

  private addAnnotation(contents: CargoMessage): void {
    const primarySpan: undefined | DiagnosticSpan = contents.message.spans.find(
      (span) => span.is_primary == true,
    );
    if (!primarySpan) {
      core.debug(
        `Unable to find primary span for message '${contents.message}', ignoring it`,
      );
      return;
    }

    // Fix file_name to include workingDirectory
    const fileName: string = `${this._workingDirectory}${primarySpan.file_name}`;
    const rendered: string = contents.message.rendered.replace(
      primarySpan.file_name,
      fileName,
    );

    const fileAnnotation: FileAnnotation = {
      title: contents.message.message,
      level: CheckRunner.annotationLevel(contents.message.level),
      beginLine: primarySpan.line_start,
      endLine: primarySpan.line_end,
      content: rendered,
    };

    // Omit these parameters if `start_line` and `end_line` have different values.
    if (primarySpan.line_start == primarySpan.line_end) {
      fileAnnotation.beginColumn = primarySpan.column_start;
      fileAnnotation.endColumn = primarySpan.column_end;
    }

    if (!this._annotations[fileName]) {
      this._annotations[fileName] = [];
    }
    this._annotations[fileName].push(fileAnnotation);
  }

  private static annotationLevel(
    messageLevel: CargoMessage['message']['level'],
  ): AnnotationLevel {
    switch (messageLevel) {
      case 'help':
      case 'note':
        return 'notice';
      case 'warning':
        return 'warning';
      default:
        return 'error';
    }
  }

  private static linesMsg(beginLine: number, endLine: number): string {
    return beginLine == endLine
      ? `Line ${beginLine}`
      : `Lines ${beginLine}-${endLine}`;
  }
}
