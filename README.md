<p align="center">
  <br/>
  <br/>
  <b>small-editor</b>
  <br />
  <br />
  <span>Extremely lightweight text editor</span>
  <br />
  <br />
  <span>
    <a href="https://www.npmjs.org/package/small-editor"><img src="https://img.shields.io/npm/v/small-editor.svg?style=flat" alt="npm"></a> 
    <a href="./LICENSE" alt="GitHub license">
      <img src="https://img.shields.io/badge/license-MIT-blue.svg" />
    </a>
  </span>
  <br />
</p>

## Feature
* Extremely lightweight, less than [2 KB](https://bundlephobia.com/package/small-editor).
* Press `Tab` to insert 4(or more) spaces.
* Press `Shift + Tab` to remove 4 spaces.
* Press `Enter` to add a new line while keeping the cursor aligned in the same column.
* Press `Enter` to add same Markdown prefix to the new line( e.g., `*`, `1.`, `>`, `+`, `-`, `- [ ]`, `- [x]` ).
* Typing a left character like  `(`, `[`, `{`, `"` will automatically insert the matching right character `)`, `]`, `}`, `"` respectively.
* Autosave functionality.
* Press "=" to automatically calculate the result of the preceding mathematical formula.

## Usage

1. Install the package
```shell
npm install small-editor --save
```

2. Import the package
```typescript
import { Editor } from 'small-editor';
```

3. Create an instance of the editor
```typescript
const editor = new Editor({
  container: document.getElementById('editorContainerDiv'),
  history: 'Hello, World!',
  /*
  history: [
    { time: 17000000000, text: 'Hello World V2' },
    { time: 16000000000, text: 'Hello World V1' },
  ],
  */
  onAutoSave: (newHistoryList) => {
    console.log(newHistoryList);
  }
});
```

4. Get the value of the editor
```typescript
const textValue = editor.getValue();
```


## License
MIT