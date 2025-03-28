export interface IConfig {
    container: HTMLDivElement;
    tabSize: number;
    props?: Record<string, string>;
    copyToNewLineChar?: string[];
    autoInsert?: Record<string, string>;
    autoSaveSize?: number;
}

enum EKeyCodeType {
    Tab = 'Tab',
    Enter = 'Enter',
    Backspace = 'Backspace',
    Shift = 'Shift',
}

interface ICursor {
    start: number;
    end: number;
    line: number;
    column: number;
    // 当前行
    currentLine: string;
    // 当前行，光标前内容
    currentLineBefore: string;
    // 当前行，光标后内容
    currentLineAfter: string;
    // 当前行之前所有内容
    beforeContent: string;
    // 当前行之后所有内容
    afterContent: string;
}

export class Editor {
    private textarea: HTMLTextAreaElement;
    private isOnShift: boolean = false;
    private autoSaveData: { time: number; text: string}[] = [];
    private autoSaveTimer: number;
    constructor(private config: IConfig) {
        this.config.tabSize = config.tabSize || 4;
        this.config.copyToNewLineChar = config.copyToNewLineChar || ['- [ ] ', '- [x] ', '+ ', '- ', '* ', '1. ', '> '];
        this.config.autoInsert = config.autoInsert || {
            '(':')',
            '[': ']',
            '{': '}',
            '"': '"',
            "'": "'",
            '`': '`',
            '【': '】',
        };
        this.config.autoSaveSize = config.autoSaveSize ?? 9;
        this.init();
    }

    private init() {
        const textarea = document.createElement('textarea');
        textarea.onkeydown = this.handleKeyDown.bind(this);
        textarea.onkeyup = this.handleKeyUp.bind(this);
        this.config.container.appendChild(textarea);

        if (this.config.props) {
            Object.keys(this.config.props).forEach((key) => {
                textarea.setAttribute(key, this.config.props[key]);
            });
            if (this.config.props.value) {
                textarea.value = this.config.props.value;
            }
        }

        textarea.value = `com 
        test word
        + 123123
        1. 123123123123
        - [ ] task
        lalala`
        this.textarea = textarea;
    }

  


    private handleKeyDown(e: KeyboardEvent) {
        const keyCode = e.key;
        switch (keyCode) {
            case EKeyCodeType.Tab:
                e.preventDefault();
                break;
            case EKeyCodeType.Shift:
                this.isOnShift = true;
                break;
            case EKeyCodeType.Enter:
                e.preventDefault();
                this.handleEnterDown(e);
                break;
        }

        if (this.config.autoInsert[keyCode]) {
            e.preventDefault();
            this.autoInsertChar(keyCode);
        }

    }

    private handleKeyUp(e: KeyboardEvent) {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.triggerAutoSaveChange();
        }, 1000);
        const keyCode = e.key;
        switch (keyCode) {
            case EKeyCodeType.Tab:
                this.handleTabUp(e);
                break;
            case EKeyCodeType.Shift:
                this.isOnShift = false;
                break;
        }
    }

    private handleTabUp(e: KeyboardEvent) {
        e.preventDefault();
        const cursorPosition = this.getCurrentCursorPosition();
        const { start, currentLine, currentLineAfter } = cursorPosition;
        if (this.isOnShift) {
            // 当前行最开始删除 tab 或 空格
            const checkCurrentLineStartSpaceSize = currentLine.match(/^(\s+)/)?.[0] || '';
            const removeSpace = Math.min(this.config.tabSize, checkCurrentLineStartSpaceSize.length);
            this.textarea.value = `${cursorPosition.beforeContent}${currentLine.slice(removeSpace)}${cursorPosition.afterContent}`;
            this.changeCursorPosition(start - removeSpace);
            return;
        }
        // 当前位置添加 tab
        this.textarea.value = `${cursorPosition.beforeContent}${cursorPosition.currentLineBefore}${this.padSpace(this.config.tabSize)}${cursorPosition.currentLineAfter}${cursorPosition.afterContent}`;
        this.changeCursorPosition(start + this.config.tabSize);
    }

    private handleEnterDown(e) {
        const cursorPosition = this.getCurrentCursorPosition();
        // 把当前行后面的部分移到下一行，并与当前行的缩进保持一致
        const currentLineAfter = cursorPosition.currentLineAfter;
        const currentLineBefore = cursorPosition.currentLineBefore;
        const checkCurrentLineStartSpaceSize = currentLineBefore.match(/^(\s+)/)?.[0] || '';
        const trimBeforeLine = currentLineBefore.replace(/^\s+/, '');

        let preChar = '';
        const lineStartChar = this.config.copyToNewLineChar.find((char) => {
            const startWith = trimBeforeLine.startsWith(char);
            if (startWith) {
                preChar = char;
                return char;
            }
            if (char === '1. ') {
                preChar = trimBeforeLine.match(/^\d+\.\s/)?.[0] || '';
                return  preChar ? char : '';
            }
        });

        const tabSize = checkCurrentLineStartSpaceSize.length;
        let insertSpace = tabSize;
        let newLine = `${this.padSpace(tabSize)}${currentLineAfter}`;
        if (lineStartChar) {

            if (/^\d+/.test(preChar)) {
                preChar = preChar.replace(/^\d+/, (num) => {
                    return `${Number(num) + 1}`;
                });
            }
            insertSpace += preChar.length;
            newLine = `${this.padSpace(tabSize)}${preChar}${currentLineAfter}`
        }
        this.textarea.value = `${cursorPosition.beforeContent}${currentLineBefore}\n${newLine}${cursorPosition.afterContent}`;
        this.changeCursorPosition(cursorPosition.start + insertSpace + 1);
    }

    private autoInsertChar(keyCode) {
        const cursorPosition = this.getCurrentCursorPosition();
        const { start, currentLineBefore, currentLineAfter } = cursorPosition;
        this.textarea.value = `${cursorPosition.beforeContent}${currentLineBefore}${keyCode}${this.config.autoInsert[keyCode]}${currentLineAfter}${cursorPosition.afterContent}`;
        this.changeCursorPosition(start + 1);
    }

    // 获取当前光标位置
    private getCurrentCursorPosition(): ICursor {
        const { selectionStart, selectionEnd } = this.textarea;
        const value = this.textarea.value;
        const allLines = value.split('\n');
        const line = value.substr(0, selectionStart).split('\n').length;
        const column = value.substr(0, selectionStart).split('\n').pop().length;
        
        const currentLine = allLines[line - 1];
        const preLines = allLines.slice(0, line - 1);
        let beforeContent = preLines.join('\n');
        if (preLines.length) {
            beforeContent += '\n';
        }
        const nestLine = allLines.slice(line);
        let afterContent = nestLine.join('\n');
        if (nestLine.length) {
            afterContent = '\n' + afterContent;
        }
        const currentLineBefore = currentLine.substr(0, column);
        const currentLineAfter = currentLine.substr(column);
        return {
            start: selectionStart,
            end: selectionEnd,
            line,
            column,
            currentLine,
            currentLineBefore,
            currentLineAfter,
            beforeContent,
            afterContent,
        };
    }

    private padSpace(num: number): string {
        return Array(num).fill(' ').join('');
    }

    // 设置光标位置
    private changeCursorPosition(position: number) {
        this.textarea.focus();
        this.textarea.setSelectionRange(position, position);
    }

    private triggerAutoSaveChange() {
        if (!this.config.autoSaveSize) {
            return;
        }
        const value = this.textarea.value;
        const now = Date.now();
        const last = this.autoSaveData[this.autoSaveData.length - 1];
        if (last && (now - last.time < 10000 || last.text === value)) {
            last.text = value;
            this.triggerAutoSave();
            return;
        }
        // 最新更新的内容
        // 从新到旧的历史记录，每个历史记录之间的时间间隔为 10的 n 次方，最后一个为 1 次方、倒数第二个为 2 次方
        const newSaveData = [];
        for (let i = 0; i < this.autoSaveData.length; i++) {
            const curIndex = newSaveData.length;
            const canUsed = Math.pow(4, this.config.autoSaveSize - curIndex - 1) * 10 * 1000;
            const item = this.autoSaveData[i];
            if (now - item.time < canUsed) {
                newSaveData.push(item);
            }
        }
        this.autoSaveData = newSaveData;
        if (this.autoSaveData.length < this.config.autoSaveSize) {
            this.autoSaveData.push({ time: now, text: value });
        } else {
            this.autoSaveData[this.config.autoSaveSize - 1] = { time: now, text: value };
        }
        this.triggerAutoSave();
    }


    private triggerAutoSave() {
        console.log('auto save', this.autoSaveData);
    }
}