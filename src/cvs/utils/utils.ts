import { ANALYSIS_METRICS, METRICS_WEIGHTS } from "src/common/helpers/consts";
import { CVFullAnalysis, CVMetricAnalysis } from "../types/cv";

export const createOrderedPageRender = () => {
    return async (pageData: any): Promise<string> => {
        const textContent = await pageData.getTextContent();

        const sortedItems = textContent.items.sort((a: any, b: any) => {
            const yDiff = b.transform[5] - a.transform[5];
            if (Math.abs(yDiff) <= 5) {
                return a.transform[4] - b.transform[4];
            }
            return yDiff;
        });

        let lastY = -1;
        let lastX = -1;
        let lastWidth = 0;
        let fullText = '';

        for (const item of sortedItems) {
            const currentY = item.transform[5];
            const currentX = item.transform[4];

            if (lastY !== -1) {
                if (Math.abs(currentY - lastY) > 5) {
                    fullText += '\n';
                }
                else {
                    const gap = currentX - (lastX + lastWidth);
                    if (gap > 2) {
                        fullText += ' ';
                    }
                }
            }

            fullText += item.str;

            lastY = currentY;
            lastX = currentX;
            lastWidth = item.width || 0;
        }

        return fullText;
    };
};

export const calculateOverallScore = (analysis: Record<string, CVMetricAnalysis>): number => {
    let overallScore = 0;
    for (const metric in ANALYSIS_METRICS) {
        overallScore += analysis[ANALYSIS_METRICS[metric]].overallScore * METRICS_WEIGHTS[ANALYSIS_METRICS[metric]];
    }
    return Math.floor(overallScore);
}
