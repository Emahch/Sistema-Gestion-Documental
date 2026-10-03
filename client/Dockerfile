FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4200
ENV NG_CLI_ANALYTICS=false CHOKIDAR_USEPOLLING=true
CMD ["sh", "-c", "npm run start -- --host 0.0.0.0 --port 4200 --poll 2000"]
