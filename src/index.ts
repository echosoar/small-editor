export interface IConfig {
    container: HTMLDivElement;
    tabSize: number;
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
    constructor(private config: IConfig) {
        console.log('Editor class', config);
        this.config.tabSize = config.tabSize || 4;
        this.init();
    }

    private init() {
        const textarea = document.createElement('textarea');
        textarea.onkeydown = this.handleKeyDown.bind(this);
        textarea.onkeyup = this.handleKeyUp.bind(this);
        this.config.container.appendChild(textarea);
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
        }

    }

    private handleKeyUp(e: KeyboardEvent) {
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
        // 光标处于行最后
        if (currentLineAfter.trim() === '') {
            // 给当前行最开始添加 tab
            this.textarea.value = `${cursorPosition.beforeContent}${this.padSpace(this.config.tabSize)}${cursorPosition.currentLineBefore}${cursorPosition.currentLineAfter}${cursorPosition.currentLineAfter}${cursorPosition.afterContent}`;
            this.changeCursorPosition(start + this.config.tabSize);
        } else {
            // 当前位置添加 tab
            this.textarea.value = `${cursorPosition.beforeContent}${cursorPosition.currentLineBefore}${this.padSpace(this.config.tabSize)}${cursorPosition.currentLineAfter}${cursorPosition.afterContent}`;
            this.changeCursorPosition(start + this.config.tabSize);
        }

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
}