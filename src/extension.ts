import * as vscode from 'vscode';
import { FileSizeAndStats } from './fileSizeStats';

const stats = new FileSizeAndStats();

export function activate(context: vscode.ExtensionContext) {
	stats.activate(context);
}

export function deactivate() {
	stats.deactivate();
}
