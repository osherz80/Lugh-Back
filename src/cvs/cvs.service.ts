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
    getCVFileType(mimeType: string) {
        return mimeMap[mimeType] || 'unknown';
    }

    async parseDocx(file: Express.Multer.File): Promise<string | undefined> {
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

    async parsePdf(file: Express.Multer.File): Promise<string | undefined> {
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

    async getRoleTag(text: string) {
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

    deterministicATSScore(cvText: string, file: Express.Multer.File) {
        let score = 100;
        const fileType = this.getCVFileType(file.mimetype)
        if (fileType !== FILE_TYPES_MAP.pdf) {
            console.log('bad file type', file.mimetype)
            score -= 20;
        }

        const hasEmail = CV_CHECK_PATTERNS.EMAIL.test(cvText);
        const hasLinkedIn = CV_CHECK_PATTERNS.LINKEDIN.test(cvText);//TODO: check hyperlink
        const hasGitHub = CV_CHECK_PATTERNS.GITHUB.test(cvText);

        if (!hasEmail) score -= 30;
        !hasEmail && console.log("No email found in CV -30pt")
        if (!hasLinkedIn) score -= 15;
        !hasLinkedIn && console.log("No linkedin found in CV -15pts")
        if (!hasGitHub) score -= 10;
        !hasGitHub && console.log("No github found in CV -10pts")

        const wordCount = cvText.split(/\s+/).length;
        if (wordCount < 200 || wordCount > 1500) {
            score -= 15;
            wordCount < 200 && console.log("CV is too short -15pt")
            wordCount > 1500 && console.log("CV is too long -15pt")
        }

        return Math.max(0, score);
    }

    cleanText(text: string): string {
        return text
            .replace(/\s\s+/g, ' ') // החלפת רווחים כפולים/מרובים ברווח אחד
            .replace(/\n\s+\n/g, '\n\n') // ניקוי שורות ריקות עם רווחים
            .trim();
    }

    async smartATSScore(cvText: string, roleTag: string) {
        const prompt = prompts.CV_SMART_ATS_SCORE_PROMPT
            .replace('[TARGET_ROLE]', roleTag!)
            .replace('[RESUME_TEXT]', cvText);

        const score = await askAi(prompt);
        console.log("Smart score: ", score);

        return score;
    }

    async getAtstsScore(file: Express.Multer.File, cvText: string, roleTag: string) {
        const deterministicScore = this.deterministicATSScore(cvText, file);
        console.log("Deterministic ATS score: ", deterministicScore);
        const smartScore = await this.smartATSScore(cvText, roleTag);
        console.log("Smart ATS score: ", smartScore);
        const overallScore = deterministicScore * 0.5 + (+smartScore!['ats_score']) * 0.5;
        console.log("Overall ATS score: ", overallScore);
        return overallScore;
    }

    deterministicLayoutScore(cvText: string) {
        let score = 100;

        // 1. עקביות בפורמט תאריכים
        const numericDate = CV_CHECK_PATTERNS.DATE_NUMERIC.test(cvText);
        const textualDate = CV_CHECK_PATTERNS.DATE_TEXTUAL.test(cvText);
        if (numericDate && textualDate) {
            score -= 20;
            console.log("Layout: Inconsistent date formats detected (-20pts)");
        }

        // 2. בדיקת צפיפות פסקאות (Density)
        const paragraphs = cvText.split('\n').map(p => p.trim()).filter(p => p.length > 0);
        const hasDenseBlocks = paragraphs.some(p => p.split(/\s+/).length > 50);
        if (hasDenseBlocks) {
            score -= 15;
            console.log("Layout: Dense text blocks (walls of text) detected (-15pts)");
        }

        // 3. בדיקת נוכחות בולטים (Scannability)
        // מחפש סימני רשימה נפוצים בתחילת שורה
        const bulletRegex = CV_CHECK_PATTERNS.BULLET;
        const hasBullets = bulletRegex.test(cvText);
        if (!hasBullets) {
            score -= 20;
            console.log("Layout: No bullet points found. Low scannability (-20pts)");
        }

        // 4. בדיקת שטח לבן ויחס מילים (White Space Balance)
        const wordCount = cvText.split(/\s+/).length;

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

    async smartLayoutScore(cvText: string) {

        const prompt = prompts.CV_SMART_LAYOUT_SCORE_PROMPT
            .replace('[RESUME_TEXT]', cvText);// TODO: check if should send src file

        const score = await askAi(prompt);
        console.log("SmartLayout score: ", score);
        return score
    }

    async getLayoutScore(cvText: string) {
        const deterministicScore = await this.deterministicLayoutScore(cvText);
        console.log("LAYOUT Deterministic score: ", deterministicScore);
        const smartScore = await this.smartLayoutScore(cvText);
        console.log("LAYOUT Smart score: ", smartScore);
        const overallScore = deterministicScore * 0.5 + (+smartScore!['layout_score']) * 0.5;
        console.log("LAYOUT Overall score: ", overallScore);
        return overallScore;
    }

    deterministicKeywordsScore(cvText: string) {
        return 0;// TODO: implement after constructing vocabulary
    }

    async smartKeywordsScore(cvText: string, roleTag: string) {
        const prompt = prompts.CV_SMART_KEYWORDS_SCORE_PROMPT
            .replace('[ROLE_TAG]', roleTag!)
            .replace('[RESUME_TEXT]', cvText);

        const score = await askAi(prompt);
        console.log("Smart score: ", score);

        return score;
    }

    async getKeywordsScore(cvText: string, roleTag: string) {
        const deterministicScore = this.deterministicKeywordsScore(cvText);
        const smartScore = await this.smartKeywordsScore(cvText, roleTag);
        const overallScore = +smartScore!['keywords_score'];
        console.log("KEYWORDS Overall score: ", overallScore);
        return overallScore;
    }

    deterministicImpactScore(text: string) {
        // 1. זיהוי נתונים כמותיים: מספרים גדולים, אחוזים, סימני פלוס, דולר וכו'
        // מחפש: 200,000+, 99.9%, $10k, 50M
        const metricsRegex = CV_CHECK_PATTERNS.METRICS;
        const metricsFound = text.match(metricsRegex) || [];

        // // 2. ניתוח בולטים (הנחה שכל שורה חדשה או נקודה בטקסט הנקי היא בולט)
        // const bullets = text.split('\n').filter(line => line.trim().length > 5);

        // let shortBullets = 0;
        // let longBullets = 0;
        // let idealBullets = 0;

        // bullets.forEach(bullet => {
        //     const wordCount = bullet.trim().split(/\s+/).length;
        //     if (wordCount < 5) shortBullets++;
        //     else if (wordCount > 25) longBullets++;
        //     else if (wordCount >= 10 && wordCount <= 20) idealBullets++;
        // });

        let impactScore = 0;
        impactScore += Math.min(metricsFound.length * 20, 100);

        // if (bullets.length > 0) {
        //     const idealRatio = idealBullets / bullets.length;
        //     impactScore += Math.min(idealRatio * 100, 50);
        // }

        // return {
        //     metricsCount: metricsFound.length,
        //     // bulletAnalysis: {
        //     //     totalBullets: bullets.length,
        //     //     shortBullets,
        //     //     longBullets,
        //     //     idealBullets
        //     // },
        //     score: Math.round(impactScore)
        // };
        return Math.round(impactScore);
    }

    async smartImpactScore(cvText: string, roleTag: string) {
        const prompt = prompts.CV_SMART_IMPACT_SCORE_PROMPT
            .replace('[ROLE_TAG]', roleTag!)
            .replace('[RESUME_TEXT]', cvText);

        const score = await askAi(prompt);
        console.log("SmartImpact score: ", score);
        return score
    }

    async getImpactScore(cvText: string, roleTag: string) {
        const deterministicScore = this.deterministicImpactScore(cvText);
        console.log("Impact Deterministic score: ", deterministicScore);
        const smartScore = await this.smartImpactScore(cvText, roleTag);
        console.log("Impact Smart score: ", smartScore);

        const overallScore = deterministicScore * 0.5 + (+smartScore!['impact_score']) * 0.5;
        console.log("IMPACT Overall score: ", overallScore);
        return overallScore;
    }

    async getCVScore(file: Express.Multer.File) {
        const cvText = await this.parseCV(file);
        const cvCleanText = this.cleanText(cvText!);
        const roleTag = await this.getRoleTag(cvCleanText!);
        const [keywordsScore, layoutScore, impactScore, atsScore] = await Promise.all([
            this.getKeywordsScore(cvCleanText, roleTag!),
            this.getLayoutScore(cvCleanText),
            this.getImpactScore(cvCleanText, roleTag!),
            this.getAtstsScore(file, cvCleanText!, roleTag!)
        ]);

        const finalScore = keywordsScore * 0.25 + layoutScore * 0.2 + impactScore * 0.35 + atsScore * 0.2;
        console.log("Final score: ", finalScore);
        return { keywordsScore, layoutScore, impactScore, atsScore, finalScore };
    }
}