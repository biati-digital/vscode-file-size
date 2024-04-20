import * as vscode from 'vscode';
import { FileSize } from './fileSize';

const fileSize = new FileSize();

export function activate(context: vscode.ExtensionContext) {
	fileSize.activate(context);
}

export function deactivate() {
	fileSize.deactivate();
}
