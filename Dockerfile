FROM node:18
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .

# Add environment variables
COPY .env /app/.env
RUN npm install dotenv keycloak-connect express

CMD [ "node", "src/index.js" ]
