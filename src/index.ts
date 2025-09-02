export interface IConfig {
    container: HTMLDivElement;
    tabSize: number;
    props?: Record<string, any>;
    copyToNewLineChar?: string[];
    autoInsert?: Record<string, string>;
    autoSaveSize?: number;
    autoCalc?: boolean;
    history?: IHistoryData[];
    onAutoSave?: (newHistory: IHistoryData[]) => void;
    onChange?: (value: string) => void;
    onUpload?: (file: File) => Promise<{ success: boolean; url: string; }>;
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
            '《': '》',
        };
        this._config.autoSaveSize = config.autoSaveSize ?? 9;
        this._config.autoCalc = config.autoCalc ?? true;
        this.init();
    }

    public getTextarea() {
        return this.textarea;
    }

    private init() {
        const textarea = document.createElement('textarea');
        textarea.onkeydown = this._handleKeyDown.bind(this);
        textarea.onkeyup = this._handleKeyUp.bind(this);
        textarea.addEventListener('compositionstart', this._handleComposition.bind(this));
        textarea.addEventListener('compositionupdate', this._handleComposition.bind(this));
        textarea.addEventListener('compositionend', this._handleComposition.bind(this));
        textarea.addEventListener('dragover', this._handleDragOver.bind(this));
        textarea.addEventListener('drop', this._handleDrop.bind(this));
        this._config.container.appendChild(textarea);

        if (this._config.props) {
            Object.keys(this._config.props).forEach((key) => {
                if (key.startsWith('on')) {
                    const eventName = key.slice(2).toLowerCase();
                    textarea.addEventListener(eventName, this._config.props[key] as any);
                    return;
                }
                if (key === 'value') {
                    textarea.value = this._config.props.value;
                    return;
                }
                textarea.setAttribute(key, this._config.props[key]);
            });
        }
        if (this._autoSaveData.length) {
            textarea.value = this._autoSaveData[this._autoSaveData.length - 1].text || '';
        }
        this.textarea = textarea;
    }

    private _handleDragOver(e: DragEvent) {
        e.preventDefault();
    }

    private _handleDrop(e: DragEvent) {
        e.preventDefault();
        
        if (!this._config.onUpload) {
            return;
        }

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) {
            return;
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith('image/')) {
                this._handleImageUpload(file);
            }
        }
    }

    private async _handleImageUpload(file: File) {
        if (!this._config.onUpload) {
            return;
        }

        const fileName = file.name;
        const uploadId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        const placeholder = `![${fileName}](uploading...${uploadId})`;
        
        // Insert placeholder at current cursor position
        const cursorPosition = this._getCurrentCursorPosition();
        const { start } = cursorPosition;
        
        this.textarea.value = `${cursorPosition.beforeContent}${cursorPosition.currentLineBefore}${placeholder}${cursorPosition.currentLineAfter}${cursorPosition.afterContent}`;
        this._changeCursorPosition(start + placeholder.length);

        try {
            const result = await this._config.onUpload(file);
            
            if (result.success && result.url) {
                // Replace placeholder with actual URL
                const newPlaceholder = `![${fileName}](${result.url})`;
                const currentValue = this.textarea.value;
                const updatedValue = currentValue.replace(
                    `![${fileName}](uploading...${uploadId})`,
                    newPlaceholder
                );
                
                this.textarea.value = updatedValue;
                
                // Trigger onChange if configured
                if (this._config.onChange) {
                    this._config.onChange(this.textarea.value);
                }
            }
        } catch (error) {
            // On error, replace with error message
            const errorPlaceholder = `![${fileName}](upload-failed)`;
            const currentValue = this.textarea.value;
            const updatedValue = currentValue.replace(
                `![${fileName}](uploading...${uploadId})`,
                errorPlaceholder
            );
            this.textarea.value = updatedValue;
        }
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
                case '>':
                    if (this._shouldAutoCompleteHtmlTag()) {
                        e.preventDefault();
                        this._autoCompleteHtmlTag();
                    }
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

    private _shouldAutoCompleteHtmlTag(): boolean {
        const cursorPosition = this._getCurrentCursorPosition();
        const { currentLineBefore } = cursorPosition;
        
        // Check if the text before cursor looks like an HTML tag start
        // Match patterns like <div, <span, <p, etc. with optional attributes
        // Supports: <div, <div , <div class="test", <span id="myid" class="test"
        const htmlTagPattern = /<([a-zA-Z][a-zA-Z0-9]*)[^>]*$/;
        return htmlTagPattern.test(currentLineBefore);
    }

    private _autoCompleteHtmlTag() {
        const cursorPosition = this._getCurrentCursorPosition();
        const { start, currentLineBefore, currentLineAfter } = cursorPosition;
        
        // Extract the tag name from HTML tag with optional attributes
        // Supports: <div, <div , <div class="test", <span id="myid" class="test"
        const match = currentLineBefore.match(/<([a-zA-Z][a-zA-Z0-9]*)[^>]*$/);
        if (match) {
            const tagName = match[1];
            const replacement = `></${tagName}>`;
            
            this.textarea.value = `${cursorPosition.beforeContent}${currentLineBefore}${replacement}${currentLineAfter}${cursorPosition.afterContent}`;
            // Position cursor between the tags
            this._changeCursorPosition(start + 1);
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
        if (this._config.onChange) {
            this._config.onChange(this.textarea.value);
        }
    }

    private handleTabUp(e: KeyboardEvent) {
        e.preventDefault();
        const { selectionStart, selectionEnd } = this.textarea;
        
        // Check if multiple lines are selected
        if (selectionStart !== selectionEnd) {
            this._handleMultiLineIndentation();
            return;
        }
        
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

    private _handleMultiLineIndentation() {
        const { selectionStart, selectionEnd, value } = this.textarea;
        const lines = value.split('\n');
        
        // Find which lines are selected
        let charCount = 0;
        let startLine = -1;
        let endLine = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const lineStart = charCount;
            const lineEnd = charCount + lines[i].length;
            
            if (startLine === -1 && selectionStart <= lineEnd) {
                startLine = i;
            }
            if (selectionEnd <= lineEnd) {
                endLine = i;
                break;
            }
            charCount = lineEnd + 1; // +1 for newline character
        }
        
        if (endLine === -1) endLine = lines.length - 1;
        
        // Apply indentation/dedentation to selected lines
        let newSelectionStart = selectionStart;
        let newSelectionEnd = selectionEnd;
        let positionOffset = 0;
        
        for (let i = startLine; i <= endLine; i++) {
            if (this.isOnShift) {
                // Remove indentation
                const spaceMatch = lines[i].match(/^(\s+)/);
                const spaces = spaceMatch ? spaceMatch[0] : '';
                const removeSpace = Math.min(this._config.tabSize, spaces.length);
                
                if (removeSpace > 0) {
                    lines[i] = lines[i].slice(removeSpace);
                    
                    // Adjust selection positions
                    if (i === startLine) {
                        newSelectionStart = Math.max(newSelectionStart - removeSpace, 
                            newSelectionStart - (newSelectionStart - this._getLineStartPosition(lines, i)));
                    }
                    if (i <= endLine) {
                        positionOffset -= removeSpace;
                    }
                }
            } else {
                // Add indentation
                lines[i] = this._padSpace(this._config.tabSize) + lines[i];
                
                // Adjust selection positions
                if (i === startLine) {
                    newSelectionStart += this._config.tabSize;
                }
                if (i <= endLine) {
                    positionOffset += this._config.tabSize;
                }
            }
        }
        
        newSelectionEnd = selectionEnd + positionOffset;
        
        this.textarea.value = lines.join('\n');
        this.textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    }
    
    private _getLineStartPosition(lines: string[], lineIndex: number): number {
        let position = 0;
        for (let i = 0; i < lineIndex; i++) {
            position += lines[i].length + 1; // +1 for newline
        }
        return position;
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
        let insertSpaceSize = tabSize;
        const insertSpace = this._padSpace(tabSize);
        let newLine = `${insertSpace}${currentLineAfter}`;
        if (lineStartChar) {
            let checkIsEmpty = insertSpace + lineStartChar === currentLineBefore;
            if (/^\d+/.test(preChar)) {
                checkIsEmpty = insertSpace + preChar === currentLineBefore;
                preChar = preChar.replace(/^\d+/, (num) => {
                    return `${Number(num) + 1}`;
                });
            }
            if (checkIsEmpty) {
                // 删除当前行的内容，仅保留行首的空格
                newLine = `${insertSpace}${currentLineAfter}`;
                insertSpaceSize = 0;
                this.textarea.value = `${cursorPosition.beforeContent}${newLine}${cursorPosition.afterContent}`;
                this._changeCursorPosition(cursorPosition.start - lineStartChar.length);
                return;
            }
            insertSpaceSize += preChar.length;
            newLine = `${insertSpace}${preChar}${currentLineAfter}`
        }
        this.textarea.value = `${cursorPosition.beforeContent}${currentLineBefore}\n${newLine}${cursorPosition.afterContent}`;
        this._changeCursorPosition(cursorPosition.start + insertSpaceSize + 1);
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
            const match = currentLineBefore.match(/(\d+(\.\d+)?\s*[+|\-|*|/]\s*)+\d+(\.\d+)?\s*=$/);
            if (match) {
                let spaceBeforeEqual = '';
                let calcStr = match[0].replace(/(\s*)=$/, (_, space) => {
                    spaceBeforeEqual = space;
                    return '';
                });
                try {
                    let res = this._calculateWithPrecision(calcStr);
                    this.textarea.value = `${cursorPosition.beforeContent}${currentLineBefore}${spaceBeforeEqual}${res}${cursorPosition.afterContent}`;
                    this._changeCursorPosition(start + res.toString().length + spaceBeforeEqual.length);
                } catch {}
            }
        }
    }

    private _calculateWithPrecision(expression: string): number {
        // Replace eval with a safer calculation that handles floating point precision
        try {
            let result = eval(expression);
            
            // Round to avoid floating point precision issues
            // Use 10 decimal places as a reasonable precision limit
            if (typeof result === 'number') {
                return Math.round(result * 1e10) / 1e10;
            }
            return result;
        } catch (error) {
            throw error;
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