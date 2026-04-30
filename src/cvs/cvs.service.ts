import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { LoadParameters, PDFParse } from 'pdf-parse';
import * as mammoth from "mammoth";

import { askAi, askAiLite } from "src/common/helpers/ai";
import { CV_CHECK_PATTERNS, FILE_TYPES_MAP, mimeMap } from "src/common/helpers/consts";
import { createOrderedPageRender } from "src/common/helpers/utils";
import * as prompts from "src/common/helpers/prompts";
import { Multer } from "multer";

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

            const rawText = result.value;
            const warnings = result.messages;

            if (warnings.length > 0) {
                console.warn('DOCX parsing warnings:', warnings);
            }
            return rawText;
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

            const rawText = (await parser.getText()).text;
            return rawText;
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
        const fileRawText = await parseMap[fileType](file)
        return fileRawText;
    }

    async uploadCV(file: Express.Multer.File) {
        try {
            const fileRawText = await this.parseCV(file);

            return fileRawText;
        } catch (error) {
            throw new Error('Failed to parse CV: ' + error.message);
        }
    }

    private async getRoleTag(text: string) {
        try {
            const prompt = prompts.CV_ROLE_TAG_EXTRACTOR_PROMPT
                .replace('[RESUME_TEXT]', text);
            const roleTag = await askAiLite(prompt);
            console.log("Role tag: ", roleTag);
            return roleTag;
        } catch (error) {
            console.error('Failed to extract role tag: ', error);
            return undefined;
        }
    }

    private deterministicATSScore(text: string, file: Express.Multer.File) {
        let score = 100;
        const fileType = this.getCVFileType(file.mimetype)
        if (fileType !== FILE_TYPES_MAP.pdf) {
            console.log('bad file type', file.mimetype)
            score -= 20;
        }

        const hasEmail = CV_CHECK_PATTERNS.EMAIL.test(text);
        const hasLinkedIn = CV_CHECK_PATTERNS.LINKEDIN.test(text);//TODO: check hyperlink
        const hasGitHub = CV_CHECK_PATTERNS.GITHUB.test(text);

        if (!hasEmail) score -= 30;
        !hasEmail && console.log("No email found in CV -30pt")
        if (!hasLinkedIn) score -= 15;
        !hasLinkedIn && console.log("No linkedin found in CV -15pts")
        if (!hasGitHub) score -= 10;
        !hasGitHub && console.log("No github found in CV -10pts")

        const wordCount = text.split(/\s+/).length;
        if (wordCount < 200 || wordCount > 1500) {
            score -= 15;
            wordCount < 200 && console.log("CV is too short -15pt")
            wordCount > 1500 && console.log("CV is too long -15pt")
        }

        return Math.max(0, score);
    }

    private cleanText(text: string): string {
        return text
            .replace(/\s\s+/g, ' ') // החלפת רווחים כפולים/מרובים ברווח אחד
            .replace(/\n\s+\n/g, '\n\n') // ניקוי שורות ריקות עם רווחים
            .trim();
    }

    private async smartATSScore(text: string, file: Express.Multer.File) {
        const roleTag = await this.getRoleTag(text);
        if (!roleTag) {
            console.log("Role tag not found.");
        }

        console.log("Original text: ", text);

        const cleanText = this.cleanText(text);
        console.log("Clean text: ", cleanText);

        const prompt = prompts.CV_SMART_ATS_SCORE_PROMPT
            .replace('[TARGET_ROLE]', roleTag!)
            .replace('[RESUME_TEXT]', cleanText);

        const score = await askAi(prompt);
        console.log("Smart score: ", score);

        return score;
    }

    async getAtstsScore(file: Express.Multer.File) {
        const text = await this.parseCV(file);
        text && console.log("CV text extracted");
        const deterministicScore = this.deterministicATSScore(text!, file);
        console.log("Deterministic score: ", deterministicScore);
        const smartScore = await this.smartATSScore(text!, file);
        console.log("Smart score: ", smartScore);
        const overallScore = deterministicScore * 0.5 + (+smartScore!['ats_score']) * 0.5;
        console.log("Overall score: ", overallScore);
        return overallScore;
    }

    private deterministicLayoutScore(text: string) {
        let score = 100;

        // 1. עקביות בפורמט תאריכים
        const numericDate = CV_CHECK_PATTERNS.DATE_NUMERIC.test(text);
        const textualDate = CV_CHECK_PATTERNS.DATE_TEXTUAL.test(text);
        if (numericDate && textualDate) {
            score -= 20;
            console.log("Layout: Inconsistent date formats detected (-20pts)");
        }

        // 2. בדיקת צפיפות פסקאות (Density)
        const paragraphs = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
        const hasDenseBlocks = paragraphs.some(p => p.split(/\s+/).length > 50);
        if (hasDenseBlocks) {
            score -= 15;
            console.log("Layout: Dense text blocks (walls of text) detected (-15pts)");
        }

        // 3. בדיקת נוכחות בולטים (Scannability)
        // מחפש סימני רשימה נפוצים בתחילת שורה
        const bulletRegex = /^[•\-\*◦]/m;
        const hasBullets = bulletRegex.test(text);
        if (!hasBullets) {
            score -= 20;
            console.log("Layout: No bullet points found. Low scannability (-20pts)");
        }

        // 4. בדיקת שטח לבן ויחס מילים (White Space Balance)
        const wordCount = text.split(/\s+/).length;

        if (wordCount < 200) {
            // מסמך דליל מדי - נראה חובבני או ריק
            score -= 15;
            console.log("Layout: Document is too thin / Too much white space (-15pts)");
        } else if (wordCount > 1000) {
            // מסמך עמוס מדי - עלול להתיש את הקורא האנושי
            score -= 10;
            console.log("Layout: Document is too cluttered / Low white space (-10pts)");
        }

        // 5. בדיקת אורך משפטים בבולטים (אופציונלי אך מומלץ)
        const bullets = paragraphs.filter(p => bulletRegex.test(p));
        const longBullets = bullets.filter(b => b.split(/\s+/).length > 35);
        if (longBullets.length > 2) {
            score -= 10;
            console.log("Layout: Bullet points are too wordy (-10pts)");
        }

        return Math.max(0, score);
    }

    private async smartLayoutScore(text: string, file: Express.Multer.File) {

        const prompt = prompts.CV_SMART_LAYOUT_SCORE_PROMPT
            .replace('[RESUME_TEXT]', text);// TODO: check if should send src file

        const score = await askAi(prompt);
        console.log("SmartLayout score: ", score);
        return score
    }

    async getLayoutScore(file: Express.Multer.File) {
        const text = await this.parseCV(file);
        const deterministicScore = this.deterministicLayoutScore(text!);
        console.log("LAYOUT Deterministic score: ", deterministicScore);
        const smartScore = await this.smartLayoutScore(text!, file);
        console.log("LAYOUT Smart score: ", smartScore);
        const overallScore = deterministicScore * 0.5 + (+smartScore!['layout_score']) * 0.5;
        console.log("LAYOUT Overall score: ", overallScore);
        return overallScore;
    }

    private deterministicKeywordsScore(text: string) {
        return 0;// TODO: implement after constructing vocabulary
    }

    private async smartKeywordsScore(text: string, file: Express.Multer.File) {
        const roleTag = await this.getRoleTag(text);
        if (!roleTag) {
            console.log("Role tag not found.");
        }
        const cleanText = this.cleanText(text);
        const prompt = prompts.CV_SMART_KEYWORDS_SCORE_PROMPT
            .replace('[ROLE_TAG]', roleTag!)
            .replace('[RESUME_TEXT]', cleanText);

        const score = await askAi(prompt);
        console.log("Smart score: ", score);

        return score;
    }

    async getKeywordsScore(file: Express.Multer.File) {
        const text = await this.parseCV(file);
        const deterministicScore = this.deterministicKeywordsScore(text!);
        const smartScore = await this.smartKeywordsScore(text!, file);
        const overallScore = +smartScore!['keywords_score'];
        console.log("KEYWORDS Overall score: ", overallScore);
        return overallScore;
    }
}