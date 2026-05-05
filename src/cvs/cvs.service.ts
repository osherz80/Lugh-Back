import { Inject, Injectable, InternalServerErrorException } from "@nestjs/common";
import { LoadParameters, PDFParse } from 'pdf-parse';
import * as mammoth from "mammoth";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

import { askAi } from "src/common/helpers/ai";
import { CV_CHECK_PATTERNS, FILE_TYPES_MAP } from "src/common/helpers/consts";
import { cleanText, getFileType } from "src/common/helpers/utils";
import { calculateOverallScore, createOrderedPageRender } from "./utils/utils";
import * as prompts from "src/common/helpers/prompts";
import { DRIZZLE } from "src/drizzle/drizzle.module";
import * as schema from '../db/schema/index';
import { CVFullAnalysis, CVMetricAnalysis, CVDeterministicAnalysis, RoleTag, CVSmartAnalysis } from "./types/cv";


interface ExtendedLoadParameters extends LoadParameters {
    pagerender?: (pageData: any) => Promise<string>;
}

@Injectable()
export class CVService {
    constructor(@Inject(DRIZZLE) private db: PostgresJsDatabase<typeof schema>) { }

    async parseDocx(file: Express.Multer.File): Promise<string> {
        try {
            const result = await mammoth.extractRawText({ buffer: file.buffer });

            const rawText = result.value;
            const warnings = result.messages;

            if (warnings.length > 0) {
                console.warn('DOCX parsing warnings:', warnings);
            }
            return rawText;
        } catch (error) {
            console.log("error parsing docx: ", error);
            throw new Error('Failed to parse DOCX file: ' + error.message);
        }
    }

    async parsePdf(file: Express.Multer.File): Promise<string> {
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
            console.log("error parsing pdf: ", error);
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

        const fileType = getFileType(file.mimetype)
        const fileRawText = await parseMap[fileType](file)
        const cleanCVText = cleanText(fileRawText)
        return cleanCVText;
    }

    async getRoleTag(text: string): Promise<RoleTag> {
        try {
            const prompt = prompts.CV_ROLE_TAG_EXTRACTOR_PROMPT
                .replace('[RESUME_TEXT]', text);
            const roleTag = await askAi<RoleTag>(prompt);
            if (!roleTag) {
                console.log("error getting Role tag: ", roleTag);
                throw new Error("Could not extract role tag");
            }
            console.log("Role tag: ", roleTag);
            return roleTag;
        } catch (error) {
            console.error('Failed to extract role tag: ', error);
            throw new Error('Failed to extract role tag: ' + error.message);
        }
    }

    deterministicATSAnalysis(cvText: string, file: Express.Multer.File): CVDeterministicAnalysis {
        let score = 100;
        const fileType = getFileType(file.mimetype)
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

        return { score: Math.max(0, score) }
    }

    async smartATSAnalysis(cvText: string, roleTag: string): Promise<CVSmartAnalysis> {
        const prompt = prompts.CV_SMART_ATS_SCORE_PROMPT
            .replace('[TARGET_ROLE]', roleTag!)
            .replace('[RESUME_TEXT]', cvText);

        try {

            const analysis = await askAi<CVSmartAnalysis>(prompt);
            if (!analysis) {
                console.log("error getting Smart ATS analysis: ", analysis);
                throw new Error("Could not extract Smart ATS analysis");
            }
            console.log("Smart ATS analysis: ", analysis);
            return analysis;
        } catch (error) {
            console.log("error getting ATS Smart analysis: ", error);
            throw new Error("Could not extract ATS Smart analysis");
        }
    }

    async ATSAnalysis(file: Express.Multer.File, cvText: string, roleTag: string): Promise<CVMetricAnalysis> {
        try {

            const { score: deterministicScore } = this.deterministicATSAnalysis(cvText, file);
            console.log("Deterministic ATS score: ", deterministicScore);
            const { score: smartScore, tips } = await this.smartATSAnalysis(cvText, roleTag);
            console.log("Smart ATS score: ", smartScore);
            const overallScore = Math.floor(deterministicScore * 0.5 + smartScore * 0.5);
            console.log("Overall ATS score: ", overallScore);
            return { overallScore, tips, deterministicScore, smartScore };
        } catch (error) {
            console.error("error getting full ATS score: ", error);
            throw new Error("Could not get full ATS score");
        }
    }

    deterministicLayoutAnalysis(cvText: string): CVDeterministicAnalysis {
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

        return { score: Math.max(0, score) }
    }

    async smartLayoutAnalysis(cvText: string): Promise<CVSmartAnalysis> {
        try {
            const prompt = prompts.CV_SMART_LAYOUT_SCORE_PROMPT
                .replace('[RESUME_TEXT]', cvText);// TODO: check if should send src file

            const score = await askAi<CVSmartAnalysis>(prompt);
            if (!score) {
                console.log("error getting full layout score")
                throw new Error("error getting full layout score")
            }
            console.log("SmartLayout score: ", score);
            return score
        } catch (err) {
            console.log("error getting full layout score")
            throw new Error("error getting full layout score")
        }
    }

    async layoutAnalysis(cvText: string): Promise<CVMetricAnalysis> {
        try {
            const { score: deterministicScore } = this.deterministicLayoutAnalysis(cvText);
            console.log("LAYOUT Deterministic score: ", deterministicScore);
            const { score: smartScore, tips } = await this.smartLayoutAnalysis(cvText);
            console.log("LAYOUT Smart score: ", smartScore);
            const overallScore = Math.floor(deterministicScore * 0.5 + smartScore * 0.5);
            console.log("LAYOUT Overall score: ", overallScore);
            return { overallScore, tips, deterministicScore, smartScore };
        } catch (err) {
            console.log("error getting full layout score", err)
            throw new Error("error getting full layout score")
        }
    }

    deterministicKeywordsAnalysis(cvText: string): CVDeterministicAnalysis {
        return { score: 0 };// TODO: implement after constructing vocabulary
    }

    async smartKeywordsAnalysis(cvText: string, roleTag: string): Promise<CVSmartAnalysis> {
        try {
            const prompt = prompts.CV_SMART_KEYWORDS_SCORE_PROMPT
                .replace('[ROLE_TAG]', roleTag!)
                .replace('[RESUME_TEXT]', cvText);

            const score = await askAi<CVSmartAnalysis>(prompt);
            if (!score) {
                console.log("error getting smart keywords score")
                throw new Error("error getting smart keywords score")
            }
            console.log("Smart keywords score: ", score);
            return score;
        } catch (err) {
            console.log("error getting smart keywords score")
            throw new Error("error getting smart keywords score")
        }
    }

    async keywordsAnalysis(cvText: string, roleTag: string): Promise<CVMetricAnalysis> {
        try {
            const { score: deterministicScore } = this.deterministicKeywordsAnalysis(cvText);
            console.log("KEYWORDS Deterministic score: ", deterministicScore);
            const { score: smartScore, tips } = await this.smartKeywordsAnalysis(cvText, roleTag);
            console.log("KEYWORDS Smart score: ", smartScore);
            // const overallScore = deterministicScore * 0.5 + smartScore * 0.5;
            const overallScore = Math.floor(smartScore);
            console.log("KEYWORDS Overall score: ", overallScore);
            return { overallScore, tips, deterministicScore, smartScore };
        } catch (error) {
            console.log("error getting full keywords analysis")
            throw new Error("error getting full keywords analysis")
        }
    }

    deterministicImpactAnalysis(text: string): CVDeterministicAnalysis {
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
        return { score: Math.round(impactScore) };
    }

    async smartImpactAnalysis(cvText: string, roleTag: string): Promise<CVSmartAnalysis> {
        try {
            const prompt = prompts.CV_SMART_IMPACT_SCORE_PROMPT
                .replace('[ROLE_TAG]', roleTag!)
                .replace('[RESUME_TEXT]', cvText);

            const score = await askAi<CVSmartAnalysis>(prompt);
            if (!score) {
                console.log("error getting smart impact score")
                throw new Error("error getting smart impact score")
            }
            console.log("SmartImpact score: ", score);
            return score
        } catch (err) {
            console.log("error getting smart impact score")
            throw new Error("error getting smart impact score")
        }
    }

    async impactAnalysis(cvText: string, roleTag: string): Promise<CVMetricAnalysis> {
        try {
            const { score: deterministicScore } = this.deterministicImpactAnalysis(cvText);
            console.log("Impact Deterministic score: ", deterministicScore);
            const { score: smartScore, tips } = await this.smartImpactAnalysis(cvText, roleTag);
            console.log("Impact Smart score: ", smartScore);
            const overallScore = Math.floor(deterministicScore * 0.5 + smartScore * 0.5);
            console.log("IMPACT Overall score: ", overallScore);
            return { overallScore, tips, deterministicScore, smartScore };
        } catch (err) {
            console.log("error getting full impact score")
            throw new Error("error getting full impact score")
        }
    }

    async getCVFullAnalysis(cvText: string, roleTag: string, file: Express.Multer.File): Promise<CVFullAnalysis> {
        const [keywords, layout, impact, ats] = await Promise.all([
            this.keywordsAnalysis(cvText, roleTag),
            this.layoutAnalysis(cvText),
            this.impactAnalysis(cvText, roleTag),
            this.ATSAnalysis(file, cvText, roleTag)
        ]);

        const score = calculateOverallScore({ ats, layout, keywords, impact });
        console.log("Final score: ", score);
        return { score, ats, layout, keywords, impact, tips: ats.tips };
    }

    async uploadCv(file: Express.Multer.File, userId: string) {
        try {
            const cvCleanText = await this.parseCV(file);
            const { roleTag } = await this.getRoleTag(cvCleanText);
            const cvAnalysis = await this.getCVFullAnalysis(cvCleanText, roleTag, file)
            const cv = await this.db.insert(schema.cvs).values({
                candidateId: userId,
                content: cvCleanText,
                fileName: file.originalname,
                atsScore: cvAnalysis.ats.overallScore,
                impactScore: cvAnalysis.impact.overallScore,
                keywordsScore: cvAnalysis.keywords.overallScore,
                layoutScore: cvAnalysis.layout.overallScore,
                overallScore: cvAnalysis.score,
                roleTag: roleTag,
            })
        } catch (err) {
            console.log("error uploading cv", err)
            throw new Error("error uploading cv")
        }
    }

    async getCVs(candidateId: string) {
        try {
            console.log("getting cvs for candidate: ", candidateId);
            return await this.db.query.cvs.findMany({
                where: (cvs) => eq(cvs.candidateId, candidateId),
                columns: {
                    embedding: false,
                    content: false,
                }
            })
        } catch (err) {
            console.log("error getting cvs", err)
            throw new Error("error getting cvs")
        }
    }
}