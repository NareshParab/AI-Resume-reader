import * as genai from '@google/genai';
console.log(Object.keys(genai));
if (genai.GoogleGenAI) {
  console.log(Object.getOwnPropertyNames(genai.GoogleGenAI.prototype));
}
