export const CV_EXTRACTION_PROMPT = `Extract the data from this CV and format it as a Google Document AI JSON object.
Focus on the text field (full cleaned text) and the entities array.
For each entity, include type, mentionText, and where relevant, properties for nested data like work experience (company, title, date range).
Use the following entity types: person_name, contact_info, skill, work_history, education.`

export const CV_STRUCTURE_PROMPT = `Analyze this messy PDF text from a resume and return a structured JSON with: Personal Info, Skills, Experience (Company, Role, Dates, Key achievements), and Education.`
