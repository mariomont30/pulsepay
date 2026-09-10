FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
# Generate Prisma client during build (worker uses @prisma/client)
RUN npx prisma generate || true
CMD ["node", "src/worker.js"]
