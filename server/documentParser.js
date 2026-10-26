import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/**
 * Extracts plain text or formatted Markdown from PDF or Word (.docx, .doc) files.
 * @param {Buffer} buffer
 * @param {string} mediaType
 * @param {string} [originalName]
 * @returns {Promise<string>}
 */
export async function extractDocumentText(buffer, mediaType = '', originalName = '') {
  if (!buffer || buffer.length === 0) return '';

  const isDocx = (mediaType && (mediaType.includes('word') || mediaType.includes('docx') || mediaType.includes('document'))) ||
                 (originalName && originalName.toLowerCase().endsWith('.docx')) ||
                 (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04);

  const isDoc = (mediaType && mediaType === 'application/msword') ||
                (originalName && originalName.toLowerCase().endsWith('.doc')) ||
                (buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0);

  const isPdf = (mediaType && mediaType === 'application/pdf') ||
                (originalName && originalName.toLowerCase().endsWith('.pdf')) ||
                (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46);

  // 1. Word Document (.docx)
  if (isDocx) {
    try {
      const mdResult = await mammoth.convertToMarkdown({ buffer });
      if (mdResult && mdResult.value && mdResult.value.trim().length > 0) {
        return mdResult.value.trim();
      }
    } catch (e) {
      console.warn('Mammoth convertToMarkdown warning:', e.message);
    }

    try {
      const rawResult = await mammoth.extractRawText({ buffer });
      if (rawResult && rawResult.value) {
        return rawResult.value.trim();
      }
    } catch (e) {
      console.warn('Mammoth extractRawText warning:', e.message);
    }
  }

  // 2. PDF Document
  if (isPdf) {
    try {
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      if (textResult && textResult.text) {
        return textResult.text.trim();
      }
    } catch (e) {
      console.warn('PDFParse warning:', e.message);
    }
  }

  // 3. Legacy Word Document (.doc)
  if (isDoc) {
    try {
      const str = buffer.toString('latin1');
      const printable = str.replace(/[^\x20-\x7E\t\r\n]/g, ' ').replace(/\s+/g, ' ');
      return printable.trim();
    } catch (e) {
      console.warn('Legacy doc extraction warning:', e.message);
    }
  }

  return '';
}

/**
 * Checks if a given mediaType or file name is a document (PDF or Word)
 */
export function isDocumentType(mediaType = '', fileName = '') {
  const mt = (mediaType || '').toLowerCase();
  const fn = (fileName || '').toLowerCase();
  return mt === 'application/pdf' ||
         mt.includes('word') ||
         mt.includes('officedocument') ||
         mt === 'application/msword' ||
         fn.endsWith('.pdf') ||
         fn.endsWith('.docx') ||
         fn.endsWith('.doc');
}
