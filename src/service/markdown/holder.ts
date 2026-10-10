import * as vscode from 'vscode';

export class Holder{
    public static activeDocument:vscode.TextDocument|null;
    private static exportPreparations = new Map<string, () => Promise<void>>();

    public static registerExportPreparation(uri: vscode.Uri, prepare: () => Promise<void>) {
        const key = uri.toString();
        this.exportPreparations.set(key, prepare);
        return new vscode.Disposable(() => {
            if (this.exportPreparations.get(key) === prepare) {
                this.exportPreparations.delete(key);
            }
        });
    }

    public static async prepareExport(uri: vscode.Uri) {
        await this.exportPreparations.get(uri.toString())?.();
    }
}
