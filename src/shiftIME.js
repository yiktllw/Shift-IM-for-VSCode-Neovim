"use strict";

const vscode = require('vscode')
const hscopes = require('./hscopes')
const koffi = require('koffi');
const nvim = vscode.extensions.getExtension('asvetliakov.vscode-neovim').exports;

let cnLParam = vscode.workspace.getConfiguration().get("Settings.ChineseModeCode") ?? 1025
let enLParam = vscode.workspace.getConfiguration().get("Settings.EnglishModeCode") ?? 0
let getWParam = vscode.workspace.getConfiguration().get("Settings.GetParam") ?? 0x001
let setWParam = vscode.workspace.getConfiguration().get("Settings.SetParam") ?? 0x002

let currentInMath = false
let previousInMath = false
let currentMode = "normal"
let previousMode = "insert"
let lastLParam = enLParam


/**
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
    imcController(setWParam, enLParam);
    // vscode.window.showInformationMessage("shiftIME has been started");
    nvim.onModeChange(() => {
        // 获取当前激活的文档和光标位置
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            currentMode = nvim.getMode();
            // 如果当前由insert切换到normal，则将输入法设为英文，并将未切换时的输入法状态记住。
            // 如果当前(已经切换模式)是insert模式，则将输入法设为之前记住的状态，并执行一次:根据上下文切换状态。
            // vscode.window.showInformationMessage("Your Mode Changed!")
            if (currentMode != "insert") {
                if (previousMode == "insert" && !hscopes.getScopeAt(activeEditor.document, activeEditor.selection.active)) {
                    lastLParam = imcController(getWParam, 0);
                }
                imcController(setWParam, enLParam);
            } else {
                let doNotSwitchToCN_ = false;
                if (lastLParam === enLParam) {
                    doNotSwitchToCN_ = true;
                }
                imcController(setWParam, lastLParam == enLParam ? enLParam : cnLParam);
                const document = activeEditor.document;
                const position = activeEditor.selection.active;
                // 调用 toggleImeCondition 并传递文档和位置
                toggleImeCondition(document, position, true, doNotSwitchToCN_);
                // vscode.window.showInformationMessage("insert mode toggle");
            }
            previousMode = currentMode;
        }
    })
    vscode.window.onDidChangeTextEditorSelection((e) => {
        const activeEditor = vscode.window.activeTextEditor;
        const document = activeEditor.document;
        const position = activeEditor.selection.active;
        toggleImeCondition(document, position)
        // vscode.window.showInformationMessage(`当前光标位置：(${position.line + 1}, ${position.character + 1})`)
    })
    vscode.workspace.onDidChangeConfiguration((e) => {
        e && e.affectsConfiguration("Settings.ChineseModeCode") && (cnLParam = vscode.workspace.getConfiguration().get("Settings.ChineseModeCode") ?? 1025)
        e && e.affectsConfiguration("Settings.EnglishModeCode") && (enLParam = vscode.workspace.getConfiguration().get("Settings.EnglishModeCode") ?? 0)
        e && e.affectsConfiguration("Settings.GetParam") && (getWParam = vscode.workspace.getConfiguration().get("Settings.GetParam") ?? 0x001)
        e && e.affectsConfiguration("Settings.SetParam") && (setWParam = vscode.workspace.getConfiguration().get("Settings.SetParam") ?? 0x002)
    })
    context.subscriptions.push(
        vscode.commands.registerCommand('shiftIm.debug', im_debug)
    )
}

// win32api ////////////////////////////////////////////////

// Import user32
const user32 = koffi.load('user32.dll')
const imm32 = koffi.load('imm32.dll')

const GetForegroundWindow = user32.stdcall("GetForegroundWindow", "int32", [])
const SendMessageW = user32.stdcall("SendMessageW", 'int32', ['long', 'int32', 'int32', 'int32'])
const ImmGetDefaultIMEWnd = imm32.stdcall("ImmGetDefaultIMEWnd", "int32", ["int32"])

/**
 * @param {number} wParam wParam for WM_IME_CONTROL
 * @param {number} lParam lParam for WM_IME_CONTROL
 */
function imcController(wParam, lParam) {
    var hwnd = GetForegroundWindow()
    var defaultIMEWnd = ImmGetDefaultIMEWnd(hwnd)
    return SendMessageW(defaultIMEWnd, 0x283, wParam, lParam);
}

// main /////////////////////////////////////////////////////

/**
 * @param {vscode.TextDocument} document 
 * @param {vscode.Position} position 
 */
function toggleImeCondition(document, position, strong = false, doNotSwithToCN = false) {
    // Get scope
    const scope = hscopes.getScopeAt(document, position);
    if (nvim.getMode() != "insert") {
        imcController(setWParam, enLParam);
        return;
    }
    // If ( scope not change ) return;
    currentInMath = scope;
    if (currentInMath === previousInMath && !strong) {
        return;
    }
    // Else: 
    // in math environment => to EN ; Else => to CN
    if (currentInMath) {
        imcController(setWParam, enLParam);
    } else if (doNotSwithToCN) {
        imcController(setWParam, enLParam);
    } else {
        imcController(setWParam, cnLParam);
    }
    previousInMath = currentInMath;
}

// debug ///////////////////////////////////////////
async function im_debug() {
    try { await im_test(getWParam, setWParam) }
    catch (e) {
        if (e === 'Exit') return;
        try {
            if (e === 'ext_im_codeEqs')
                await showInfo('中英文模式代码相同，无法在此 wParam 下切换。点击“Continue”更改 wParam 并测试')
            if (e === 'No')
                await showInfo('无法有效切换，点击“Continue”更改 wParam 并测试')
            const _getWParam = (getWParam === 0x001 ? 0x005 : 0x001);
            const _setWParam = (setWParam === 0x002 ? 0x006 : 0x002)
            await im_test(_getWParam, _setWParam)
        } catch (e) {
            if (e === 'Exit') return;
            vscode.window.showInformationMessage("无法有效切换，插件可能不可用。请重试，或在 https://github.com/yfzhao20/Shift-IM-for-VSCode/issues 提交 Issue。")
        }
    }
}

/**
 * @param {number} get 
 * @param {number} set 
 * @returns {Promise}
 */
async function im_test(get, set) {
    return new Promise(async function (resolve, reject) {
        try {
            await showInfo(`<Shift IM Debug> 当前 wParam: 0x00${get}/0x00${set}. 点击“Continue”开始测试`)
            await showInfo(`请将输入法置于英文模式，然后点击“Continue”`)
            const en = imcController(get, 0)
            await showInfo(`请将输入法置于中文模式，然后点击“Continue”`)
            const cn = imcController(get, 0)
            if (en === cn)
                throw 'ext_im_codeEqs'
            await showInfo(`您的中文模式代码为 ${cn} ，英文模式代码为 ${en} 。请将输入法置于中文模式，并点击“Continue”以测试切换`)
            imcController(set, en)
            await showInfo(`是否成功切换为英文模式？`, 'Yes', 'No')
            await showInfo(`请将输入法置于英文模式，并点击“Continue”以测试切换`)
            imcController(set, cn)
            await showInfo(`是否成功切换为中文模式？`, 'Yes', 'No')
            await showInfo(`测试通过，点击“Continue”更新参数，或点击“Exit”直接退出`)
            vscode.workspace.getConfiguration().update("Settings.ChineseModeCode", cn, true)
            vscode.workspace.getConfiguration().update("Settings.EnglishModeCode", en, true)
            vscode.workspace.getConfiguration().update("Settings.GetParam", get, true)
            vscode.workspace.getConfiguration().update("Settings.SetParam", set, true)
            resolve('continue')
        }
        catch (e) {
            reject(e)
        }
    })

}

/**
 * 
 * @param {string} str 
 * @param {string} res 
 * @param {string} rej 
 */
function showInfo(str, res = 'Continue', rej = 'Exit') {
    return new Promise(function (resolve, reject) {
        vscode.window.showInformationMessage(str, res, rej).then(result => {
            (result === res) ? resolve(res) : reject(rej)
        })
    })
}

module.exports = {
    activate
}