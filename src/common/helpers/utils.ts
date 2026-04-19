/**
 * Generates a pageRender function for pdf-parse that maintains visual text order.
 * Especially useful for layouts with multiple columns or sidebars.
 */
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
        let fullText = '';

        for (const item of sortedItems) {
            const currentY = item.transform[5];

            if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
                fullText += '\n';
            }

            fullText += item.str + ' ';
            lastY = currentY;
        }

        return fullText;
    };
};