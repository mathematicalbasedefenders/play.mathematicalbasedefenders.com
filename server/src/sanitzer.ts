const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const sanitizerWindow = new JSDOM("").window;
const DOMPurify = createDOMPurify(sanitizerWindow);
export { DOMPurify };
