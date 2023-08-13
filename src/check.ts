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
  private workingDirectory: string;
  private stats: Stats;

  constructor(workingDirectory?: string) {
    this.workingDirectory = workingDirectory ? `${workingDirectory}/` : '';
    this.stats = {
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
        this.stats.help += 1;
        break;
      case 'note':
        this.stats.note += 1;
        break;
      case 'warning':
        this.stats.warning += 1;
        break;
      case 'error':
        this.stats.error += 1;
        break;
      case 'error: internal compiler error':
        this.stats.ice += 1;
        break;
      default:
        break;
    }

    this.addAnnotation(contents);
  }

  public async addSummary(context: SummaryContext): Promise<void> {
    core.info(`Clippy results: \
${this.stats.ice} ICE, ${this.stats.error} errors, \
${this.stats.warning} warnings, ${this.stats.note} notes, \
${this.stats.help} help`);

    return core.summary
      .addHeading('Results')
      .addTable([
        [
          { data: 'Message level', header: true },
          { data: 'Amount', header: true },
        ],
        ['Internal compiler error', `${this.stats.ice}`],
        ['Error', `${this.stats.error}`],
        ['Warning', `${this.stats.warning}`],
        ['Note', `${this.stats.note}`],
        ['Help', `${this.stats.help}`],
      ])
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
    const fileName = `${this.workingDirectory}${primarySpan.file_name}`;
    const rendered = contents.message.rendered.replace(
      primarySpan.file_name,
      fileName,
    );

    const properties: core.AnnotationProperties = {
      title: contents.message.message,
      file: fileName,
      startLine: primarySpan.line_start,
      endLine: primarySpan.line_end,
    };

    // Omit these parameters if `start_line` and `end_line` have different values.
    if (primarySpan.line_start == primarySpan.line_end) {
      properties.startColumn = primarySpan.column_start;
      properties.endColumn = primarySpan.column_end;
    }

    // notice, warning, or error.
    switch (contents.message.level) {
      case 'help':
      case 'note':
        core.notice(rendered, properties);
        break;
      case 'warning':
        core.warning(rendered, properties);
        break;
      default:
        core.error(rendered, properties);
        break;
    }
  }
}
