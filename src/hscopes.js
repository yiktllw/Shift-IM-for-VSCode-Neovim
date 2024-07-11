
const vscode = require('vscode')


function getScopeAt(document, position) {
    const lineText = document.lineAt(position.line).text;
    const text = lineText.substr(0, position.character);

    // 检查行内数学公式
    if (text.includes('$')) {
        const dollarCount = (text.match(/\$/g) || []).length;
        if (dollarCount % 2 === 1) {
            return true;
        }
    }

    // 检查数学环境
    const mathEnvironments = [
        'equation', 'equation*', 'align', 'align*', 'gather', 'gather*',
        'multline', 'multline*', 'matrix', 'pmatrix', 'bmatrix', 'Bmatrix', 'vmatrix', 'Vmatrix',
        'cases', 'array'
    ];

    for (const environment of mathEnvironments) {
        const beginRegex = new RegExp(`\\\\begin\\{${environment}\\}`, 'i');
        const endRegex = new RegExp(`\\\\end\\{${environment}\\}`, 'i');

        let isInEnvironment = false;
        let start = -1;
        let end = -1;

        for (let i = position.line; i >= 0; i--) {
            const lineText = document.lineAt(i).text;
            start = lineText.search(beginRegex);
            if (start !== -1) {
                isInEnvironment = true;
                break;
            }
            end = lineText.search(endRegex);
            if (end !== -1) {
                break;
            }
        }

        if (isInEnvironment) {
            return true;
        }

        if (end !== -1 && (start === -1 || end < start)) {
            return false;
        }

        for (let i = position.line; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            end = lineText.search(endRegex);
            if (end !== -1) {
                isInEnvironment = true;
                break;
            }
            start = lineText.search(beginRegex);
            if (start !== -1) {
                break;
            }
        }

        if (isInEnvironment) {
            return true;
        }
    }

    return false;
}

module.exports = {
    getScopeAt,
}