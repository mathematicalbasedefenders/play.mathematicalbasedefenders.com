const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const sanitizerWindow = new JSDOM("").window;
const DOMPurifySanitizer = createDOMPurify(sanitizerWindow);
export { DOMPurifySanitizer };
