import { Editor } from '../src/index';

describe('Small Editor', () => {
    it('should export Editor class', () => {
        expect(Editor).toBeDefined();
    });

    it('should create an editor instance', () => {
        const mockContainer = document.createElement('div');
        const editor = new Editor({ 
            container: mockContainer as HTMLDivElement, 
            tabSize: 4 
        });
        expect(editor).toBeDefined();
        expect(editor.getValue).toBeDefined();
    });
});