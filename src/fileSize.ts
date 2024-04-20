import * as brotli from 'brotli-size';
import dayjs from 'dayjs';
import * as fs from 'fs';
import { gzipSizeSync } from 'gzip-size';
import * as vscode from 'vscode';

export interface FileData {
    absolutePath: string;
    size: number;
    gzipSize: number;
    brotliSize: number;
    dateCreated: string;
    dateChanged: string;
    prettyDateCreated: string;
    prettyDateChanged: string;
}

export interface ConfigValues {
    statusBarText?: string;
    dateFormat?: string;
    sizeMode?: string;
    statusItemPosition?: string;
    statusItemPriority?: number
}

export class FileSize {
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
        const configuration = vscode.workspace.getConfiguration('filesize');
        this.config = {
            statusBarText: configuration.get('statusBarText'),
            dateFormat: configuration.get('dateFormat'),
            sizeMode: configuration.get('sizeMode'),
            statusItemPosition: configuration.get('statusItemPosition'),
            statusItemPriority: configuration.get('statusItemPriority')
        };
    }

    public activate(context: vscode.ExtensionContext): void {
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(() => {
            this.updateStatusBarItem();
        }));
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
            console.log('onDidChangeActiveTextEditor');
            this.updateStatusBarItem();
        }));
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
            let configUpdated: boolean = event.affectsConfiguration('filesize');
            if (configUpdated) {
                const newConfig = vscode.workspace.getConfiguration('filesize');
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

    public updateStatusBarItem() {
        const editor = vscode.window.activeTextEditor;
        const currentEditor = editor?.document;

        if (!currentEditor) {
            this.statusBar.hide();
            return;
        }

        if (currentEditor.uri.scheme === 'file') {
            const documentText = editor.document.getText();
            this.getFileInfo(currentEditor.fileName, documentText).then((info) => {
                const sizeData = {
                    'ORIGINAL_SIZE': this.formatSize(info.size),
                    'GZIP_SIZE': this.formatSize(info.gzipSize),
                    'BROTLI_SIZE': this.formatSize(info.brotliSize),
                    'CREATED_DATE': info.prettyDateCreated,
                    'CHANGED_DATE': info.prettyDateChanged,
                };

                let statusItemText = this.config?.statusBarText ?? '';
                for (const [key, value] of Object.entries(sizeData)) {
                    statusItemText = statusItemText.replace('${' + key + '}', value);
                }

                this.statusBar.text = statusItemText;
                this.statusBar.tooltip = new vscode.MarkdownString(
                    `**File Size**

- Created: ${info.prettyDateCreated}
- Changed: ${info.prettyDateChanged}
- Original Size: ${sizeData.ORIGINAL_SIZE}
- Gzip Size: ${sizeData.GZIP_SIZE}
- Brotli Size: ${sizeData.BROTLI_SIZE}
`
                );

                this.statusBar.show();
            });
        } else {
            this.statusBar.hide();
        }
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
                            gzipSize: gzipSizeSync(fileContent),
                            brotliSize: brotli.sync(fileContent),
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