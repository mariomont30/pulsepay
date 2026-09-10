FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
# Generate Prisma client during build so @prisma/client is available at runtime
RUN npx prisma generate || true
EXPOSE 4000
CMD ["node", "src/index.js"]
