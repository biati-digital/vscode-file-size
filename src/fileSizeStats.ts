import * as brotli from 'brotli-size';
import dayjs from 'dayjs';
import * as fs from 'fs';
import zlib from 'node:zlib';
import * as vscode from 'vscode';

export interface FileData {
    absolutePath: string;
    size: number;
    dateCreated: string;
    dateChanged: string;
    prettyDateCreated: string;
    prettyDateChanged: string;
}

export interface ConfigValues {
    eventListen?: string;
    statusBarText?: string;
    tooltipTitle?: string;
    dateFormat?: string;
    sizeMode?: string;
    statusItemPosition?: string;
    statusItemPriority?: number
    gzipLevel?: number
}

export class FileSizeAndStats {
    private configKey = 'fileSizeAndStats';
    private statusBar!: vscode.StatusBarItem;
    private DECIMAL_BASE = 1000;
    private IEC_BASE = 1024;
    private IEC_SUFIXES = [
        'bytes',
        'KiB',
        'MiB',
        'GiB',
        'TiB',
        'PiB',
        'EiB',
        'ZiB',
        'YiB',
    ];
    private DECIMAL_SUFIXES = [
        'bytes',
        'kB',
        'MB',
        'GB',
        'TB',
        'PB',
        'EB',
        'ZB',
        'YB',
    ];
    config: ConfigValues | undefined;

    constructor() {
        this.setConfig();
        this.createStatusBarItem();
    }

    private createStatusBarItem(): void {
        const statusBarPriority = this.config?.statusItemPriority || 0;
        if (this.config?.statusItemPosition === 'Left') {
            this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, statusBarPriority);
        } else {
            this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, statusBarPriority);
        }
    }

    private setConfig() {
        const configuration = vscode.workspace.getConfiguration(this.configKey);
        this.config = {
            statusBarText: configuration.get('statusBarText'),
            tooltipTitle: configuration.get('tooltipTitle'),
            dateFormat: configuration.get('dateFormat'),
            sizeMode: configuration.get('sizeMode'),
            statusItemPosition: configuration.get('statusItemPosition'),
            statusItemPriority: configuration.get('statusItemPriority'),
            eventListen: configuration.get('calculateSizeOn'),
            gzipLevel: configuration.get('gzipLevel'),
        };
    }

    public activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => {
            if (this.config?.eventListen === 'File Save') {
                this.updateStatusBarItem();
            }
        }));
        context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(() => {
            if (this.config?.eventListen === 'File Change') {
                this.updateStatusBarItem();
            }
        }));
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
            this.updateStatusBarItem();
        }));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
            let configUpdated: boolean = event.affectsConfiguration(this.configKey);
            if (configUpdated) {
                const newConfig = vscode.workspace.getConfiguration(this.configKey);
                let recreateItem = false;

                if (this.config?.statusItemPosition !== newConfig.get('statusItemPosition') ||
                    this.config?.statusItemPriority !== newConfig.get('statusItemPriority')
                ) {
                    recreateItem = true;
                }

                this.setConfig();

                if (recreateItem) {
                    this.statusBar.dispose();
                    this.createStatusBarItem();
                }
                this.updateStatusBarItem();
            }
        }));

        this.updateStatusBarItem();
    }

    public deactivate(): void {
        this.statusBar.hide();
        this.statusBar.dispose();
    }

    public updateStatusBarItem(): void {
        const editor = vscode.window.activeTextEditor;
        const currentEditor = editor?.document;
        const scheme = currentEditor?.uri.scheme;

        if (!currentEditor) {
            this.statusBar.hide();
            return;
        }

        const editorText = currentEditor.getText() || '';
        const fileStatsData = {
            'ORIGINAL_SIZE': '0 bytes',
            'GZIP_SIZE': '0 bytes',
            'BROTLI_SIZE': '0 bytes',
            'CREATED_DATE': '',
            'CHANGED_DATE': '0 bytes',
        };

        if (editorText) {
            fileStatsData.GZIP_SIZE = this.formatSize(zlib.gzipSync(editorText, { level: this.config?.gzipLevel || 9 }).length);
            fileStatsData.BROTLI_SIZE = this.formatSize(brotli.sync(editorText));
        }

        if (scheme === 'file') {
            this.getFileInfo(currentEditor.fileName, currentEditor.getText()).then((info) => {
                fileStatsData.ORIGINAL_SIZE = this.formatSize(info.size);
                fileStatsData.CREATED_DATE = info.prettyDateCreated;
                fileStatsData.CHANGED_DATE = info.prettyDateChanged;

                this.setStatusBarItemContent(fileStatsData, {
                    'Created': info.prettyDateCreated,
                    'Changed': info.prettyDateChanged,
                    'Original Size': fileStatsData.ORIGINAL_SIZE,
                    'Gzip Size': fileStatsData.GZIP_SIZE,
                    'Brotli Size': fileStatsData.BROTLI_SIZE,
                });
            });
            return;
        }

        if (scheme === 'untitled') {
            const unsavedString = 'Unsaved';
            fileStatsData.ORIGINAL_SIZE = unsavedString;

            this.setStatusBarItemContent(fileStatsData, {
                'Original Size': fileStatsData.ORIGINAL_SIZE,
                'Gzip Size': fileStatsData.GZIP_SIZE,
                'Brotli Size': fileStatsData.BROTLI_SIZE,
            });
            return;
        }

        this.statusBar.hide();
    }

    private setStatusBarItemContent(statsData: { [key: string]: string }, items: any): void {
        let statusItemText = this.config?.statusBarText ?? '';
        let tooltipTitle = this.config?.tooltipTitle ?? '';
        for (const [key, value] of Object.entries(statsData)) {
            statusItemText = statusItemText.replace('${' + key + '}', value);
        }
        this.statusBar.text = statusItemText;

        let itemsList = Object.entries(items).map((value) => {
            return `- ${value[0]}: ${value[1]}`
        }).join('\n');

        if (tooltipTitle) {
            tooltipTitle = `**${tooltipTitle}**`;
        }

        let contentMarkdown = `
            ${tooltipTitle}

            ${itemsList}
        `;

        contentMarkdown = contentMarkdown.split('\n').map((line) => {
            return line.trimStart();
        }).join('\n');
        this.statusBar.tooltip = new vscode.MarkdownString(contentMarkdown);
        this.statusBar.show();
    }

    private getFileInfo(filepath: string, fileContent: string = ''): Promise<FileData> {
        return new Promise((resolve, reject) => {
            if (filepath) {
                fs.stat(filepath, (err: any, stats: any) => {
                    if (!err) {
                        const hourFormat = this.config?.dateFormat || 'YYYY-MM-DD, HH:mm:ss';
                        const data = {
                            absolutePath: filepath,
                            size: stats.size,
                            dateCreated: stats.birthtime.toISOString(),
                            dateChanged: stats.mtime.toISOString(),
                            prettyDateCreated: dayjs(stats.birthtime.toISOString()).format(hourFormat),
                            prettyDateChanged: dayjs(stats.mtime.toISOString()).format(hourFormat),
                        };

                        resolve(data);
                    } else {
                        reject(err);
                    }
                });
            } else {
                reject(new Error('Please provide a valid filepath'));
            }
        });
    }

    private formatSize(size: number): string {
        const sizeMode = this.config?.sizeMode;
        if (size === 0) {
            return '0 bytes';
        };
        if (size === 1) {
            return '1 byte'
        };

        const useDecimal = sizeMode === 'Binary Mode';
        const base = (useDecimal) ? this.DECIMAL_BASE : this.IEC_BASE;
        const suffixes = (useDecimal) ? this.DECIMAL_SUFIXES : this.IEC_SUFIXES;
        const scale = Math.floor(Math.log(size) / Math.log(base));
        const activeSuffix = suffixes[scale];
        const scaledSize = size / Math.pow(base, scale);

        // @ts-expect-error
        const fixedScale = Math.round(`${scaledSize}e+2`);
        const roundedSize = Number(`${fixedScale}e-2`);

        return `${roundedSize} ${activeSuffix}`;
    }
}