export const JOB_POST_EXTRACTOR = `extract the details from this job posting [JOB_POST], return a json with valid details
that was mentioned in the job post explicitly only
`

export const JOB_POST_CREATOR = `you are a job descriptions expert, i need you to generate me a professional job post in a level that a real company wiil actually post
the post must include information about the company, company name, the role, responsibilities, requirements, nice to have, benefits, department, location,
work model, employment type, experience level, do not use stub values for anything - use real data for all of the required fields,
the location field should consist of only "State, City" and nothing else, also the location will never be in texas.
for any field you not sure what to put in you can just make it up as long as it looks real.
its also very important for the jobs to be more "down to earth" and matching a broader set of people,
for example: " Principal Regenerative Mycelium Materials Architect" is super niche and very high seniority and its not good but things like "data scientist"/"full stack developer"/"barista"/"PTA"/"teacher" are great titles matching a lot of people while not super niche.
do not repeat the same titles and return only the full job post!`
// the jobs does not have to be from a specific field or somthing technical, it can be any field and any seniority, do not get stuck on a specific industry/title be diverse and creative to make sure we have a wide range of jobs,

// export const JOB_POST_CREATOR = `You are a professional HR recruiter. Write a complete, ready-to-publish job posting.

// CRITICAL INSTRUCTIONS:
// 1. NEVER use brackets [], placeholders, or stub text like "[Your Company Name]" or "[Your Location]".
// 2. INVENT realistic fictional names and details if specific info is missing. For example:
//    - Company Name: "a realistic sounding company name"
//    - Location: "a random location the company could be in"
//    - Salary & Benefits: Specific details like 401(k) matching, health insurance.
// 3. Write a compelling, highly professional job description that attracts top talent.

// The post must cover: Title, Company Overview, Department, Location, Work Model (e.g. Hybrid), Employment Type, Experience Level, Responsibilities, Requirements, Nice-to-Haves, and Benefits.

// Return ONLY the complete job post text. Do not output brackets under any circumstance.`;

// export const JOB_POST_CREATOR = `give me a real job title and responsibilities of it and a company name that have this job and her location,
// also write a few words about the company`

// const job = `Job Title: Data Scientist

// Responsibilities:
// - Develop and implement predictive models to forecast future trends in data
// - Analyze large datasets to identify patterns, anomalies, and correlations
// - Collaborate with other teams to design and execute research projects
// - Use statistical techniques to analyze data and draw conclusions
// - Work closely with business stakeholders to communicate findings and insights

// Company Name: IBM

// Location: New York, NY`

// export const JOB_POST_CREATOR = 'i have this job ' + job + 'provide a list of benefits this company give to her employess, respond only with a list of benefits and nothing else'