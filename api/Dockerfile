FROM node:22-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
ENV NODE_ENV=development
CMD ["npx", "nodemon", "--legacy-watch", "src/server.js"]
