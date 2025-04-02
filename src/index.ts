export interface IConfig {
    container: HTMLDivElement;
    tabSize: number;
    props?: Record<string, string>;
    copyToNewLineChar?: string[];
    autoInsert?: Record<string, string>;
    autoSaveSize?: number;
    autoCalc?: boolean;
    history?: IHistoryData[];
    onAutoSave?: (newHistory: IHistoryData[]) => void;
}

enum EType {
    Tab = 'Tab',
    Enter = 'Enter',
    Shift = 'Shift',
    Equal = '=',
}

export interface IHistoryData { time: number; text: string}

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
    private _config: IConfig;
    private textarea: HTMLTextAreaElement;
    private isOnShift: boolean = false;
    private _autoSaveData: { time: number; text: string}[] = [];
    private autoSaveTimer: number;
    private inComposition = false;
    constructor(config: IConfig) {
        this._config = config;
        if (typeof config.history === 'string') {
            config.history = [{ time: Date.now(), text: config.history }];
        }
        this._autoSaveData = config.history || [];
        this._config.tabSize = config.tabSize || 4;
        this._config.copyToNewLineChar = config.copyToNewLineChar || ['- [ ] ', '- [x] ', '+ ', '- ', '* ', '1. ', '> '];
        this._config.autoInsert = config.autoInsert || {
            '(':')',
            '[': ']',
            '{': '}',
            '"': '"',
            "'": "'",
            '`': '`',
            '【': '】',
        };
        this._config.autoSaveSize = config.autoSaveSize ?? 9;
        this._config.autoCalc = config.autoCalc ?? true;
        this.init();
    }

    private init() {
        const textarea = document.createElement('textarea');
        textarea.onkeydown = this._handleKeyDown.bind(this);
        textarea.onkeyup = this._handleKeyUp.bind(this);
        textarea.addEventListener('compositionstart', this._handleComposition.bind(this));
        textarea.addEventListener('compositionupdate', this._handleComposition.bind(this));
        textarea.addEventListener('compositionend', this._handleComposition.bind(this));
        this._config.container.appendChild(textarea);

        if (this._config.props) {
            Object.keys(this._config.props).forEach((key) => {
                textarea.setAttribute(key, this._config.props[key]);
            });
            if (this._config.props.value) {
                textarea.value = this._config.props.value;
            }
        }
        if (this._autoSaveData.length) {
            textarea.value = this._autoSaveData[this._autoSaveData.length - 1].text || '';
        }
        this.textarea = textarea;
    }

    private _handleKeyDown(e: KeyboardEvent) {
        const keyCode = e.key;
        if (!this.inComposition) {
            switch (keyCode) {
                case EType.Tab:
                    e.preventDefault();
                    break;
                case EType.Shift:
                    this.isOnShift = true;
                    break;
                case EType.Enter:
                    e.preventDefault();
                    this._handleEnterDown(e);
                    break;
            }
            if (this._config.autoInsert[keyCode]) {
                e.preventDefault();
                this._autoInsertChar(keyCode);
            }
        } else {
            if (keyCode === EType.Enter) {
                this.inComposition = false;
            }
        }
        

       

    }

    private _handleKeyUp(e: KeyboardEvent) {
        if (this.inComposition) {
            return;
        }
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this._triggerAutoSaveChange();
        }, 500);
        const keyCode = e.key;
        switch (keyCode) {
            case EType.Tab:
                this.handleTabUp(e);
                break;
            case EType.Shift:
                this.isOnShift = false;
                break;
            case EType.Equal:
                this.autoCalc(e);
                break;
        }
    }

    private handleTabUp(e: KeyboardEvent) {
        e.preventDefault();
        const cursorPosition = this._getCurrentCursorPosition();
        const { start, currentLine, currentLineAfter } = cursorPosition;
        if (this.isOnShift) {
            // 当前行最开始删除 tab 或 空格
            const checkCurrentLineStartSpaceSize = currentLine.match(/^(\s+)/)?.[0] || '';
            const removeSpace = Math.min(this._config.tabSize, checkCurrentLineStartSpaceSize.length);
            this.textarea.value = `${cursorPosition.beforeContent}${currentLine.slice(removeSpace)}${cursorPosition.afterContent}`;
            this._changeCursorPosition(start - removeSpace);
            return;
        }
        // 当前位置添加 tab
        this.textarea.value = `${cursorPosition.beforeContent}${cursorPosition.currentLineBefore}${this._padSpace(this._config.tabSize)}${cursorPosition.currentLineAfter}${cursorPosition.afterContent}`;
        this._changeCursorPosition(start + this._config.tabSize);
    }

    private _handleEnterDown(e) {
        const cursorPosition = this._getCurrentCursorPosition();
        // 把当前行后面的部分移到下一行，并与当前行的缩进保持一致
        const currentLineAfter = cursorPosition.currentLineAfter;
        const currentLineBefore = cursorPosition.currentLineBefore;
        const checkCurrentLineStartSpaceSize = currentLineBefore.match(/^(\s+)/)?.[0] || '';
        const trimBeforeLine = currentLineBefore.replace(/^\s+/, '');

        let preChar = '';
        const lineStartChar = this._config.copyToNewLineChar.find((char) => {
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
        let newLine = `${this._padSpace(tabSize)}${currentLineAfter}`;
        if (lineStartChar) {

            if (/^\d+/.test(preChar)) {
                preChar = preChar.replace(/^\d+/, (num) => {
                    return `${Number(num) + 1}`;
                });
            }
            insertSpace += preChar.length;
            newLine = `${this._padSpace(tabSize)}${preChar}${currentLineAfter}`
        }
        this.textarea.value = `${cursorPosition.beforeContent}${currentLineBefore}\n${newLine}${cursorPosition.afterContent}`;
        this._changeCursorPosition(cursorPosition.start + insertSpace + 1);
    }

    private _autoInsertChar(keyCode) {
        const cursorPosition = this._getCurrentCursorPosition();
        const { start, currentLineBefore, currentLineAfter } = cursorPosition;
        this.textarea.value = `${cursorPosition.beforeContent}${currentLineBefore}${keyCode}${this._config.autoInsert[keyCode]}${currentLineAfter}${cursorPosition.afterContent}`;
        this._changeCursorPosition(start + 1);
    }

    private _handleComposition(e: Event) {
        this.inComposition = e.type !== 'compositionend';
    }

    private autoCalc(e: KeyboardEvent) {
        if (!this._config.autoCalc) {
            return;
        }
        const cursorPosition = this._getCurrentCursorPosition();
        const { start, currentLineBefore, currentLineAfter } = cursorPosition;
        if (!currentLineAfter) {
            const match = currentLineBefore.match(/(\d+(\.\d+)?\s*[+|-|*|/]\s*)+\d+(\.\d+)?\s*=$/);
            if (match) {
                let spaceBeforeEqual = '';
                let calcStr = match[0].replace(/(\s*)=$/, (_, space) => {
                    spaceBeforeEqual = space;
                    return '';
                });
                try {
                    let res = eval(calcStr);
                    this.textarea.value = `${cursorPosition.beforeContent}${currentLineBefore}${spaceBeforeEqual}${res}${cursorPosition.afterContent}`;
                    this._changeCursorPosition(start + res.toString().length + spaceBeforeEqual.length);
                } catch {}
            }
        }
            
    }

    // 获取当前光标位置
    private _getCurrentCursorPosition(): ICursor {
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

    private _padSpace(num: number): string {
        return Array(num).fill(' ').join('');
    }

    // 设置光标位置
    private _changeCursorPosition(position: number) {
        this.textarea.focus();
        this.textarea.setSelectionRange(position, position);
    }

    private _triggerAutoSaveChange() {
        if (!this._config.autoSaveSize) {
            return;
        }
        const value = this.textarea.value;
        const now = Date.now();
        const last = this._autoSaveData[this._autoSaveData.length - 1];
        if (last && (now - last.time < 10000 || last.text === value)) {
            last.text = value;
            this._triggerAutoSave();
            return;
        }
        // 最新更新的内容
        // 从新到旧的历史记录，每个历史记录之间的时间间隔为 10的 n 次方，最后一个为 1 次方、倒数第二个为 2 次方
        const newSaveData = [];
        for (let i = 0; i < this._autoSaveData.length; i++) {
            const curIndex = newSaveData.length;
            const canUsed = Math.pow(4, this._config.autoSaveSize - curIndex - 1) * 10 * 1000;
            const item = this._autoSaveData[i];
            if (now - item.time < canUsed) {
                newSaveData.push(item);
            }
        }
        this._autoSaveData = newSaveData;
        if (this._autoSaveData.length < this._config.autoSaveSize) {
            this._autoSaveData.push({ time: now, text: value });
        } else {
            this._autoSaveData[this._config.autoSaveSize - 1] = { time: now, text: value };
        }
        this._triggerAutoSave();
    }

    private _triggerAutoSave() {
        this._config.onAutoSave && this._config.onAutoSave(this._autoSaveData);
    }

    public getValue() {
        return this.textarea.value;
    }
}