const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const neovimExtension = vscode.extensions.getExtension('asvetliakov.vscode-neovim');

    if (!neovimExtension) {
        vscode.window.showErrorMessage('vscode-neovim extension is not installed or not enabled');
        return;
    }

    if (!neovimExtension.isActive) {
        neovimExtension.activate().then(() => {
            initExtension(context);
        });
    } else {
        initExtension(context);
    }
}

function initExtension(context){
	require('./shiftIME').activate(context);
}

function deactivate() { }

module.exports = {
	activate,	
	deactivate
}