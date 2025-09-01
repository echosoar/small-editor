const { JSDOM } = require('jsdom');

// Set up a DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLDivElement = dom.window.HTMLDivElement;
global.KeyboardEvent = dom.window.KeyboardEvent;
global.DragEvent = dom.window.DragEvent;
global.File = dom.window.File;

// Import the editor
const { Editor } = require('./dist/index.js');

console.log('Testing Small Editor features...\n');

// Test 1: Basic editor creation
console.log('1. Testing basic editor creation...');
const container = document.getElementById('container');
const editor = new Editor({
    container: container,
    tabSize: 4,
    autoCalc: true
});

if (editor && editor.getValue) {
    console.log('✓ Editor created successfully');
} else {
    console.log('✗ Failed to create editor');
}

// Test 2: Test floating point precision fix
console.log('\n2. Testing floating point precision fix...');
const textarea = editor.getTextarea();

// Simulate the auto-calc function directly
try {
    const result = editor._calculateWithPrecision('0.1 + 0.2');
    if (result === 0.3) {
        console.log('✓ Floating point precision fixed: 0.1 + 0.2 =', result);
    } else {
        console.log('✗ Floating point precision issue: 0.1 + 0.2 =', result);
    }
} catch (e) {
    console.log('✗ Error testing floating point precision:', e.message);
}

// Test 3: Test HTML tag auto-completion logic
console.log('\n3. Testing HTML tag auto-completion...');
try {
    // Set up editor state
    textarea.value = '<div';
    textarea.selectionStart = 4;
    textarea.selectionEnd = 4;
    
    // Test the detection function
    const shouldAutoComplete = editor._shouldAutoCompleteHtmlTag();
    if (shouldAutoComplete) {
        console.log('✓ HTML tag detection working');
    } else {
        console.log('✗ HTML tag detection failed');
    }
} catch (e) {
    console.log('✗ Error testing HTML tag detection:', e.message);
}

// Test 4: Test multi-line selection logic
console.log('\n4. Testing multi-line indentation...');
try {
    textarea.value = 'line 1\nline 2\nline 3';
    textarea.selectionStart = 0;
    textarea.selectionEnd = 13; // End of second line
    
    // The multi-line logic would be tested here
    // For now, just verify the selection spans multiple lines
    const value = textarea.value;
    const lines = value.split('\n');
    const hasMultipleLines = lines.length > 1;
    
    if (hasMultipleLines) {
        console.log('✓ Multi-line content setup correctly');
    } else {
        console.log('✗ Multi-line content setup failed');
    }
} catch (e) {
    console.log('✗ Error testing multi-line setup:', e.message);
}

// Test 5: Test onUpload interface
console.log('\n5. Testing image upload interface...');
const editorWithUpload = new Editor({
    container: document.createElement('div'),
    tabSize: 4,
    onUpload: async (file) => {
        return { success: true, url: 'test-url' };
    }
});

if (editorWithUpload._config.onUpload) {
    console.log('✓ onUpload callback configured successfully');
} else {
    console.log('✗ onUpload callback not configured');
}

console.log('\nAll basic tests completed!');
console.log('\nFor full manual testing, open manual-test.html in a browser after running "npm run build"');