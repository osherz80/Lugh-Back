import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { LoadParameters, PDFParse } from 'pdf-parse';
import * as mammoth from "mammoth";

import { askAi } from "src/common/helpers/ai";
import { FILE_TYPES_MAP, mimeMap } from "src/common/helpers/consts";
import { createOrderedPageRender } from "src/common/helpers/utils";
import { CV_STRUCTURE_PROMPT } from "src/common/helpers/prompts";

interface ExtendedLoadParameters extends LoadParameters {
    pagerender?: (pageData: any) => Promise<string>;
}

@Injectable()
export class CVService {
    private getCVFileType(mimeType: string) {
        return mimeMap[mimeType] || 'unknown';
    }

    private async parseDocx(file: Express.Multer.File): Promise<string | undefined> {
        try {
            const result = await mammoth.extractRawText({ buffer: file.buffer });

            const extractedText = result.value;
            const warnings = result.messages;

            if (warnings.length > 0) {
                console.warn('DOCX parsing warnings:', warnings);
            }
            const structuredText = await askAi(CV_STRUCTURE_PROMPT + extractedText);
            return structuredText
        } catch (error) {
            throw new InternalServerErrorException('Failed to process DOCX file');
        }
    }

    private async parsePdf(file: Express.Multer.File): Promise<string | undefined> {
        let parser: PDFParse | null = null;
        try {
            const data = Uint8Array.from(file.buffer);
            const parserParams: ExtendedLoadParameters = {
                data,
                pagerender: createOrderedPageRender()
            }
            parser = new PDFParse(parserParams);

            const textResult = await parser.getText();
            const infoResult = await parser.getInfo();

            const extractedText = textResult.text;

            const structuredText = await askAi(CV_STRUCTURE_PROMPT + extractedText);
            return structuredText
        } catch (error) {
            throw new Error('Failed to parse PDF: ' + error.message);
        } finally {
            if (parser) {
                await parser.destroy();
            }
        }
    }

    async parseCV(file: Express.Multer.File) {
        const parseMap = {
            [FILE_TYPES_MAP.pdf]: this.parsePdf,
            [FILE_TYPES_MAP.docx]: this.parseDocx,
        }

        const fileType = this.getCVFileType(file.mimetype)
        const parsedFile = await parseMap[fileType](file)
        return parsedFile;
    }

    async uploadCV(file: Express.Multer.File) {
        try {
            const structuredText = await this.parseCV(file)
            return structuredText;
        } catch (error) {
            throw new Error('Failed to parse CV: ' + error.message);
        }
    }
}
