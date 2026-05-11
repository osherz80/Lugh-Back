FROM node:20-alpine

WORKDIR /app

# התקנת תלויות
COPY package*.json ./
RUN npm install --frozen-lockfile

# העתקת שאר הקוד
COPY . .

# בניית הפרויקט (אם זה TS)
RUN npm run build

# חשיפת הפורט שהגדרת (5050)
EXPOSE 5050

# הרצה
CMD ["npm", "run", "start:prod"]