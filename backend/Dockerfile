FROM node:20-alpine

# Install build dependencies for bcrypt
RUN apk add --no-cache python3 make g++

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev

# Generate Prisma Client
RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
