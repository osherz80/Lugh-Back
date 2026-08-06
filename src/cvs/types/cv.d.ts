import { AnalysisMetrics } from "src/common/types/general";

export type RoleTag = {
    roleTag: string;
    confidence: number;
}

export type CVTip = {
    category: AnalysisMetrics;
    title: string;
    tip: string;
    gain: number;
}

export type CVDeterministicAnalysis = {
    score: number;
    analysis?: Record<string, any>;
}

export type CVSmartAnalysis = {
    score: number;
    analysis?: Record<string, any>;
    tips: CVTip[];
}

export type CVMetricAnalysis = {
    overallScore: number;
    deterministicScore: number;
    smartScore: number;
    tips: CVTip[];
}

export type CVFullAnalysis = {
    score: number;
    ats: CVMetricAnalysis;
    layout: CVMetricAnalysis;
    keywords: CVMetricAnalysis;
    impact: CVMetricAnalysis;
    tips: CVTip[];
}

